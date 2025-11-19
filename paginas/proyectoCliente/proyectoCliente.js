document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. CONFIGURACIÓN Y USUARIO ---
    const currentUser = JSON.parse(localStorage.getItem('usuarioActual'));
    if (!currentUser || !currentUser.token) { 
        window.location.href = '/index.html'; 
        return; 
    }
    const authToken = currentUser.token;

    let currentProject = null; 
    let projectTasks = []; 
    let projectEvidenceList = []; // ★ Nuevo: Lista de evidencias
    let currentActivityId = null; 
    let newActivityImageBase64 = null;
    let newPlagaImageBase64 = null;

    const estadoMap = { 
        1: 'project.pending', 
        2: 'project.completed' 
    };
    const HOY = new Date(); 
    HOY.setHours(0, 0, 0, 0); 

    // --- 2. ELEMENTOS DEL DOM ---
    const projectContainer = document.querySelector('.project-container');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const projectTitle = document.getElementById('project-title');
    const infoView = document.getElementById('info-view');
    const actividadesView = document.getElementById('actividades-view');
    
    const editActivityModal = document.getElementById('edit-activity-modal');
    const imageViewerModal = document.getElementById('image-viewer-modal');
    const plagaReportModal = document.getElementById('plaga-report-modal');
    const successModal = document.getElementById('success-modal');
    
    // Campos de Modal Actividad
    const modalActivityTitle = document.getElementById('modal-activity-title');
    const activityComment = document.getElementById('activity-comment');
    const activityImageInput = document.getElementById('activity-image-input');
    const uploadImageButton = document.getElementById('upload-image-button');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveActivityBtn = document.getElementById('save-activity-btn');
    
    // Campos de Modal Visor Imagen
    const viewerModalTitle = document.getElementById('viewer-modal-title');
    const modalReportImage = document.getElementById('modal-report-image');
    const closeImageViewerBtn = document.getElementById('close-image-viewer-btn');
    
    // Campos de Modal Plaga
    const btnUploadPlaga = document.getElementById('btn-upload-plaga');
    const plagaImageInput = document.getElementById('plaga-image-input');
    const plagaPreviewContainer = document.getElementById('plaga-preview-container');
    const plagaPreview = document.getElementById('plaga-preview');
    const cancelPlagaBtn = document.getElementById('cancel-plaga-btn');
    const savePlagaBtn = document.getElementById('save-plaga-btn');

    // --- 3. DATOS (API) ---
    async function fetchWithToken(url, options = {}) {
        const defaultHeaders = {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        };
        const finalOptions = {
            ...options,
            headers: { ...defaultHeaders, ...options.headers }
        };
        const response = await fetch(`${API_BASE_URL}${url}`, finalOptions);
        if (!response.ok) {
            if (response.status === 401) window.location.href = '/index.html';
            const errorText = await response.text();
            throw new Error(`Error API: ${response.status} - ${errorText}`);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) return response.json();
        return response.text();
    }

    function getTodayString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async function fetchUserProfile() {
        try {
            const userProfile = await fetchWithToken(`/perfil/${currentUser.id}`);
            welcomeMessage.textContent = `${t('greeting.welcome')}, ${userProfile.nombre}`;
        } catch (error) {
            welcomeMessage.textContent = `${t('greeting.welcome')}, ${t('common.user')} (ID: ${currentUser.id})`;
        }
    }

    async function loadProjectData(projectId) {
        try {
            const allProjects = await fetchWithToken(`/obtenerPlanCultivos`);
            currentProject = allProjects.find(p => p.idPlan == projectId && p.idUsuario == currentUser.id);
            
            if (!currentProject) throw new Error('Proyecto no encontrado.');
            
            const allUserTasks = await fetchWithToken(`/tarea`);
            projectTasks = allUserTasks.filter(task => task.idPlan == currentProject.idPlan);

            // ★ NUEVO: Cargar las evidencias ★
            try {
                const allEvidence = await fetchWithToken(`/registroactividades/`);
                projectEvidenceList = allEvidence;
            } catch (e) {
                console.warn("Error cargando evidencias", e);
                projectEvidenceList = [];
            }
            
            return true;
        } catch (error) {
            console.error("Error cargando proyecto:", error);
            projectContainer.innerHTML = `<div style="padding:40px; text-align:center;"><h2>${t('common.error')}</h2><p>${error.message}</p><a href="proyectos-lista.html" class="btn btn-primary">${t('project.back')}</a></div>`;
            return false;
        }
    }

    // --- 4. RENDERIZADO ---
    function renderProject() {
        const cultivosNombres = currentProject.cultivoPorSolicitud.map(c => c.nombreCultivo).join(', ');
        projectTitle.textContent = `${t('project.cultivationPlan')} ${cultivosNombres}`;
        renderGeneralInfo();
        renderActividadesPane();
        initializeTabNavigation();
    }
    
    function renderGeneralInfo() {
        const cultivosHtml = currentProject.cultivoPorSolicitud.map(c => `<span class="tag">${c.nombreCultivo}</span>`).join('');
        infoView.innerHTML = `
            <div class="info-grid">
                <div class="info-card"><h4 data-i18n="project.details">Detalles</h4><p><strong data-i18n="project.name">Nombre:</strong> ${currentProject.nombre}</p><p><strong data-i18n="project.location">Ubicación:</strong> ${currentProject.direccionTerreno}</p></div>
                <div class="info-card"><h4 data-i18n="project.advisoryData">Datos Asesoría</h4><p><strong data-i18n="project.objective">Objetivo:</strong> ${currentProject.motivoAsesoria}</p><p><strong data-i18n="project.observations">Observaciones:</strong> ${currentProject.observaciones || t('common.none')}</p><p><strong data-i18n="project.crops">Cultivos:</strong> ${cultivosHtml}</p></div>
                <div class="info-card full-width" id="report-plaga-card"><h4 data-i18n="project.reportProblem">Reportar Problema</h4><p data-i18n="project.detectPlague">¿Detectaste una plaga?</p><button id="add-plaga-btn-info" class="btn btn-danger" style="width:100%;" data-i18n="project.registerPlagueReport">Registrar Reporte de Plaga</button></div>
            </div>`;
    }

    function renderActividadesPane() {
        let actividadesHTML = `<div class="container-header"><h4 data-i18n="project.planActivities">Actividades del Plan</h4></div>`;
        
        if (projectTasks && projectTasks.length > 0) {
            actividadesHTML += projectTasks.map(act => {
                let estadoKey = estadoMap[act.idEstado] || 'project.pending';
                let estadoNombre = t(estadoKey);
                let estadoClass = act.idEstado === 1 ? 'status-pendiente' : 'status-completado';
                let buttonHtml = '';
                
                // Buscar evidencia para esta tarea
                const evidencia = projectEvidenceList.find(e => e.idTarea === act.idTarea);
                let evidenceLink = '';

                if (act.idEstado === 1) { 
                    buttonHtml = `<button class="btn btn-primary btn-edit" data-id="${act.idTarea}" data-i18n="project.registerEvidence">Registrar Evidencia</button>`;
                } else if (act.idEstado === 2) { 
                    buttonHtml = `<button class="btn btn-primary" style="background-color: #28a745; border-color: #28a745;" disabled data-i18n="project.completed">Completada</button>`;
                    
                    // ★ NUEVO: Si está completada y tiene evidencia, mostrar enlace ★
                    if (evidencia && evidencia.imagen) {
                        evidenceLink = `<br><a href="#" class="view-plaga-image" style="display:inline-block; margin-top:5px; color:#1C6E3E; font-weight:600;" data-url="${evidencia.imagen}" data-i18n="project.viewImage">Ver imagen</a>`;
                    }
                }

                return `
                    <div class="activity-item"> 
                        <div class="activity-info">
                            <strong>${act.nombreTarea}</strong>
                            <p><span data-i18n="project.starts">Inicia:</span> ${act.fechaInicio || 'N/A'}</p>
                            <p><span data-i18n="project.status">Estado:</span> <span class="${estadoClass}">${estadoNombre}</span></p>
                            <p><span data-i18n="project.expires">Vence:</span> ${act.fechaVencimiento}</p>
                        </div>
                        <div class="activity-actions" style="flex-direction:column; align-items:flex-end;">
                            ${buttonHtml}
                            ${evidenceLink}
                        </div>
                    </div>`;
            }).join('');
        } else {
            actividadesHTML += `<p data-i18n="project.noActivities">Aún no hay actividades.</p>`;
        }

        actividadesHTML += `
            <div class="container-header" style="margin-top: 30px;"><h4 data-i18n="project.plagueReportsHistory">Historial de Reportes de Plaga</h4></div>
            <div id="plagas-list">
                ${currentProject.reportePlagas.length === 0 ? `<p data-i18n="project.noReports">No hay reportes.</p>` : 
                    currentProject.reportePlagas.map(plaga => `
                        <div class="plaga-item">
                            <p><strong>${plaga.tipoPlaga}</strong>: ${plaga.descripcion}</p>
                            <p><span data-i18n="project.date">Fecha:</span> ${new Date(plaga.fechaReporte).toLocaleDateString()}</p>
                            ${plaga.imagen ? `<button class="btn btn-secondary btn-sm view-plaga-image" data-url="${plaga.imagen}" data-i18n="project.viewImage">Ver Imagen</button>` : ''}
                        </div>
                    `).join('')
                }
            </div>`;

        actividadesView.innerHTML = actividadesHTML;
    }
    
    function initializeTabNavigation() {
        const tabContainer = document.querySelector('.tab-navigation');
        if (!tabContainer) return;
        tabContainer.addEventListener('click', (e) => {
            if (e.target.matches('.tab-btn')) {
                tabContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
                e.target.classList.add('active');
                document.getElementById(`${e.target.dataset.tab}-view`).classList.remove('hidden');
            }
        });
    }
    
    // --- 5. MANEJO DE EVENTOS ---
    projectContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const addPlagaBtn = e.target.closest('#add-plaga-btn-info'); 
        // Este selector ahora captura tanto las imágenes de plagas como las de evidencia de tareas
        const viewImageBtn = e.target.closest('.view-plaga-image'); 

        if (editBtn) {
            currentActivityId = editBtn.dataset.id; 
            const task = projectTasks.find(t => t.idTarea == currentActivityId);
            if (task) {
                modalActivityTitle.textContent = `${t('project.evidenceFor')} ${task.nombreTarea}`;
                activityComment.value = '';
                imagePreview.src = '';
                imagePreviewContainer.classList.add('hidden');
                newActivityImageBase64 = null;
                activityImageInput.value = '';
                editActivityModal.classList.remove('hidden');
            }
        }

        if (addPlagaBtn) {
            const today = getTodayString();
            const fechaInput = document.getElementById('plaga-fecha');
            fechaInput.valueAsDate = new Date();
            fechaInput.min = today; 
            document.getElementById('plaga-tipo').value = '';
            document.getElementById('plaga-descripcion').value = '';
            plagaPreview.src = '';
            plagaPreviewContainer.classList.add('hidden');
            newPlagaImageBase64 = null;
            plagaImageInput.value = '';
            plagaReportModal.classList.remove('hidden');
        }

        if (viewImageBtn) { 
            viewerModalTitle.textContent = t('project.evidenceReport'); 
            modalReportImage.src = viewImageBtn.dataset.url; 
            imageViewerModal.classList.remove('hidden'); 
        }
    });

    saveActivityBtn.addEventListener('click', async () => {
        if (!currentActivityId) return;
        const comentario = activityComment.value;
        if (!comentario && !newActivityImageBase64) {
            alert(t('project.addCommentImage'));
            return;
        }
        const registroActividad = {
            idTarea: parseInt(currentActivityId),
            imagen: newActivityImageBase64, 
            descripcion: comentario
        };
        try {
            await fetchWithToken(`/registroactividades/`, { method: 'POST', body: JSON.stringify([registroActividad]) });
            await fetchWithToken(`/tarea/${currentActivityId}/2`, { method: 'PATCH' });
            editActivityModal.classList.add('hidden');
            successModal.classList.remove('hidden');
            setTimeout(() => successModal.classList.add('hidden'), 2000);
            
            // Recargar todo para actualizar la vista con la evidencia nueva
            await loadProjectData(currentProject.idPlan);
            renderActividadesPane(); 
        } catch (error) {
            console.error("Error:", error);
            alert(t('project.saveError'));
        }
    });
    
    savePlagaBtn.addEventListener('click', async () => {
        const tipo = document.getElementById('plaga-tipo').value;
        const descripcion = document.getElementById('plaga-descripcion').value;
        const fecha = document.getElementById('plaga-fecha').value;
        const today = getTodayString();

        if (!tipo || !descripcion || !fecha) { alert(t('project.completeFields')); return; }
        if (fecha < today) { alert(t('project.invalidDate')); return; }

        const reportePlaga = {
            idPlan: currentProject.idPlan,
            fechaReporte: `${fecha}T00:00:00`, 
            tipoPlaga: tipo,
            descripcion: descripcion,
            imagen: newPlagaImageBase64, 
            idEstado: 1,
            idTarea: 0 
        };

        try {
            await fetchWithToken(`/reporteplaga`, { method: 'POST', body: JSON.stringify(reportePlaga) });
            plagaReportModal.classList.add('hidden');
            successModal.classList.remove('hidden');
            setTimeout(() => successModal.classList.add('hidden'), 2000);
            await loadProjectData(currentProject.idPlan);
            renderGeneralInfo();
            renderActividadesPane();
        } catch (error) {
            console.error("Error:", error);
            alert(t('project.reportSaveError'));
        }
    });

    uploadImageButton.addEventListener('click', () => activityImageInput.click());
    activityImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => { newActivityImageBase64 = event.target.result; imagePreview.src = newActivityImageBase64; imagePreviewContainer.classList.remove('hidden'); };
        reader.readAsDataURL(file);
    });

    btnUploadPlaga.addEventListener('click', () => plagaImageInput.click());
    plagaImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => { newPlagaImageBase64 = event.target.result; plagaPreview.src = newPlagaImageBase64; plagaPreviewContainer.classList.remove('hidden'); };
        reader.readAsDataURL(file);
    });

    cancelEditBtn.addEventListener('click', () => editActivityModal.classList.add('hidden'));
    closeImageViewerBtn.addEventListener('click', () => imageViewerModal.classList.add('hidden'));
    cancelPlagaBtn.addEventListener('click', () => plagaReportModal.classList.add('hidden'));

    // --- 6. INICIALIZACIÓN ---
    async function initialize() {
        await fetchUserProfile();
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('id');
        if (projectId) {
            const success = await loadProjectData(projectId);
            if (success) { renderProject(); projectContainer.classList.remove('content-hidden'); }
            else projectContainer.classList.remove('content-hidden');
        } else {
            window.location.href = 'proyectos-lista.html';
        }
    }

    initialize();
});