document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. VERIFICACIÓN DE USUARIO Y ESTADO DE LA APLICACIÓN ---
    const currentUser = JSON.parse(localStorage.getItem('usuarioActual'));
    if (!currentUser || !currentUser.token) { 
        window.location.href = '/index.html'; 
        return; 
    }
    const authToken = currentUser.token;
    const API_BASE_URL = "http://localhost:7000"; 

    let currentProject = null; // Guardará el PlanCultivo
    let projectTasks = [];     // Guardará las Tareas
    let currentActivityId = null; // El idTarea que se está editando
    let newActivityImageBase64 = null;
    let newPlagaImageBase64 = null;

    // --- ★ CORRECCIÓN ★ ---
    // Mapeo de estados de TAREA simplificado
    const estadoMap = { 1: 'Pendiente', 2: 'Completada' };
    const HOY = new Date(); // Para comparar fechas de vencimiento
    HOY.setHours(0, 0, 0, 0); // Ignorar la hora

    // --- 2. SELECCIÓN DE ELEMENTOS DEL DOM ---
    const projectContainer = document.querySelector('.project-container');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const projectTitle = document.getElementById('project-title');
    const projectGeneralInfo = document.getElementById('project-general-info');
    const cropTabNavigation = document.getElementById('crop-tab-navigation');
    const cropTabContent = document.getElementById('crop-tab-content');
    
    // Modales
    const editActivityModal = document.getElementById('edit-activity-modal');
    const imageViewerModal = document.getElementById('image-viewer-modal');
    const plagaReportModal = document.getElementById('plaga-report-modal');
    const successModal = document.getElementById('success-modal');
    
    // Contenido Modal Actividad
    const modalActivityTitle = document.getElementById('modal-activity-title');
    const activityComment = document.getElementById('activity-comment');
    const activityImageInput = document.getElementById('activity-image-input');
    const uploadImageButton = document.getElementById('upload-image-button');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveActivityBtn = document.getElementById('save-activity-btn');
    
    // (Resto de selectores DOM sin cambios)
    const viewerModalTitle = document.getElementById('viewer-modal-title');
    const modalReportImage = document.getElementById('modal-report-image');
    const closeImageViewerBtn = document.getElementById('close-image-viewer-btn');
    const btnUploadPlaga = document.getElementById('btn-upload-plaga');
    const plagaImageInput = document.getElementById('plaga-image-input');
    const plagaPreviewContainer = document.getElementById('plaga-preview-container');
    const plagaPreview = document.getElementById('plaga-preview');
    const cancelPlagaBtn = document.getElementById('cancel-plaga-btn');
    const savePlagaBtn = document.getElementById('save-plaga-btn');


    // --- 3. LÓGICA DE DATOS (API) ---

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
            throw new Error(`Error de API: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return response.text();
        }
    }

    async function fetchUserProfile() {
        try {
            const userProfile = await fetchWithToken(`/perfil/${currentUser.id}`);
            welcomeMessage.textContent = `Bienvenido, ${userProfile.nombre}`;
        } catch (error) {
            console.error("Error al cargar perfil:", error);
            welcomeMessage.textContent = `Bienvenido, Usuario (ID: ${currentUser.id})`;
        }
    }

    async function loadProjectData(projectId) {
        try {
            const allProjects = await fetchWithToken(`/obtenerPlanCultivos`);
            currentProject = allProjects.find(p => p.idPlan == projectId && p.idUsuario == currentUser.id);
            
            if (!currentProject) {
                console.error("Debug: allProjects", allProjects);
                console.error("Debug: projectId", projectId);
                console.error("Debug: currentUser.id", currentUser.id);
                throw new Error('Proyecto no encontrado o no te pertenece.');
            }

            const allUserTasks = await fetchWithToken(`/tarea`);
            projectTasks = allUserTasks.filter(task => task.idPlan == currentProject.idPlan);
            
            console.log("Tareas filtradas para este proyecto:", projectTasks);

            return true;
        } catch (error) {
            console.error("Error cargando datos del proyecto:", error);
            projectContainer.innerHTML = `
                <div style="background-color: #FFFFFF; border-radius: 12px; padding: 40px; text-align: center; color: #666;">
                    <h2>Error al cargar el proyecto</h2>
                    <p>${error.message}</p>
                    <a href="proyectos-lista.html" class="btn btn-primary" style="margin-top: 20px;">Volver a la lista</a>
                </div>`;
            return false;
        }
    }

    // --- 4. LÓGICA DE RENDERIZADO PRINCIPAL ---
    
    // (renderProject y renderGeneralInfo sin cambios)
    function renderProject() {
        const cultivosNombres = currentProject.cultivoPorSolicitud.map(c => c.nombreCultivo).join(', ');
        projectTitle.textContent = `Plan de Cultivo: ${cultivosNombres}`;
        
        renderGeneralInfo();
        renderTabs();
    }
    
    function renderGeneralInfo() {
        projectGeneralInfo.querySelector('.info-grid').innerHTML = `
            <div>
                <div class="info-group"><label>Superficie Total:</label><p>${currentProject.superficieTotal} hectáreas</p></div>
                <div class="info-group"><label>Ubicación:</label><p>${currentProject.direccionTerreno}</p></div>
                <div class="info-group"><label>Agricultor:</label><p>${currentProject.nombre} ${currentProject.apellidoPaterno}</p></div>
                <div class="info-group"><label>Motivo de la Asesoría:</label><p>${currentProject.motivoAsesoria}</p></div>
                <div class="info-group"><label>Fecha Inicio:</label><p>${currentProject.fechaInicio}</p></div>
                <div class="info-group"><label>Fecha Fin:</label><p>${currentProject.fechaFin || 'N/A'}</p></div>
                <div class="info-group"><label>Observaciones del Agrónomo:</label><p>${currentProject.observaciones || 'Sin observaciones.'}</p></div>
            </div>
        `;
    }

    // (renderTabs sin cambios)
    function renderTabs() {
        cropTabNavigation.innerHTML = '';
        cropTabContent.innerHTML = '';

        cropTabNavigation.innerHTML += `<button class="tab-btn active" data-target="tab-actividades">Actividades</button>`;
        cropTabContent.innerHTML += `<div id="tab-actividades" class="tab-pane active">${renderActividadesPane()}</div>`;

        cropTabNavigation.innerHTML += `<button class="tab-btn" data-target="tab-plagas">Reportes de Plaga</button>`;
        cropTabContent.innerHTML += `<div id="tab-plagas" class="tab-pane">${renderPlagasPane()}</div>`;

        addTabListeners();
    }

    // --- ★ CORRECCIÓN: Renderizado de Tareas para Cliente ---
    function renderActividadesPane() {
        let actividadesHTML = '';
        if (projectTasks && projectTasks.length > 0) {
            
            actividadesHTML = projectTasks.map(act => {
                let estadoNombre = estadoMap[act.idEstado] || 'Desconocido';
                let estadoClass = `status-${estadoNombre.toLowerCase().replace(/[\s()]/g, '-')}`;
                let buttonHtml = '';
                
                // Lógica de estado visual "Atrasada"
                const fechaVencimiento = new Date(act.fechaVencimiento + 'T00:00:00'); // Asegurar que se compare bien
                const isAtrasada = act.idEstado === 1 && fechaVencimiento < HOY;

                if (isAtrasada) {
                    estadoNombre = 'Atrasada';
                    estadoClass = 'status-atrasada';
                }

                // Lógica para el botón
                if (act.idEstado === 1) { // 1: Pendiente (o Atrasada)
                    buttonHtml = `<button class="btn btn-primary btn-edit" data-id="${act.idTarea}">Registrar Evidencia</button>`;
                } else if (act.idEstado === 2) { // 2: Completada
                    buttonHtml = `<button class="btn btn-primary" style="background-color: #28a745; border-color: #28a745;" disabled>Completada</button>`;
                } else {
                     // Para cualquier otro estado (3, 5, etc. si existieran)
                     buttonHtml = `<button class="btn btn-secondary" disabled>${estadoNombre}</button>`;
                }

                return `
                    <div class="activity-card">
                        <div class="activity-header">
                            <h5>${act.nombreTarea}</h5>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <div class="status-badge ${estadoClass}">${estadoNombre}</div>
                                ${buttonHtml}
                            </div>
                        </div>
                        <p>${act.descripcion || 'Sin descripción.'}</p>
                        <div class="activity-dates">
                            <span><strong>Inicio:</strong> ${act.fechaInicio}</span>
                            <span><strong>Vencimiento:</strong> ${act.fechaVencimiento}</span>
                        </div>
                        <div class="evidence-box">
                            <span><strong>Evidencia:</strong> ${act.idEstado === 2 ? 'Evidencia enviada.' : 'Pendiente de envío.'}</span>
                        </div>
                    </div>`;
            }).join('');
        } else {
            actividadesHTML = '<p>Aún no hay actividades planificadas para este proyecto.</p>';
        }

        return `<h4>Actividades del Plan</h4>
                <div class="activities-list">${actividadesHTML}</div>`;
    }

    // (renderPlagasPane y addTabListeners sin cambios)
    function renderPlagasPane() {
        let plagaHTML = '';
        const reportes = currentProject.reportePlagas; 

        if (reportes && reportes.length > 0) {
            plagaHTML = reportes.map(reporte => `
                <div class="info-group"><label>Fecha de reporte:</label><p>${new Date(reporte.fechaReporte).toLocaleString()}</p></div>
                <div class="info-group"><label>Tipo de plaga:</label><p>${reporte.tipoPlaga}</p></div>
                <div class="info-group"><label>Descripción:</label><p>${reporte.descripcion}</p></div>
                ${reporte.imagen ? `<button class="btn btn-secondary view-plaga-image" data-url="${reporte.imagen}">Ver Imagen del Reporte</button>` : ''}
                <hr style="margin: 15px 0;">
            `).join('');
        }
        
        plagaHTML += `<button class="btn btn-primary btn-add-plaga" data-id-plan="${currentProject.idPlan}">Crear Nuevo Reporte de Plaga</button>`;

        return `<h4>Reportes de Plaga del Plan</h4>
                <div class="plaga-report-section">${plagaHTML}</div>`;
    }
    
    function addTabListeners() {
        const buttons = cropTabNavigation.querySelectorAll('.tab-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                cropTabNavigation.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                cropTabContent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const pane = document.getElementById(btn.dataset.target);
                if (pane) pane.classList.add('active');
            });
        });
    }
    
    // --- 5. MANEJO DE EVENTOS (MODALES) ---
    
    // (Listener 'click' principal sin cambios en los selectores)
    document.querySelector('.main-content').addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const viewPlagaImageBtn = e.target.closest('.view-plaga-image');
        const addPlagaBtn = e.target.closest('.btn-add-plaga');

        if (editBtn) {
            currentActivityId = editBtn.dataset.id;
            const task = projectTasks.find(t => t.idTarea == currentActivityId);
            
            if (task) {
                modalActivityTitle.textContent = `Evidencia para: ${task.nombreTarea}`;
                activityComment.value = '';
                imagePreview.src = '';
                imagePreviewContainer.classList.add('hidden');
                newActivityImageBase64 = null;
                activityImageInput.value = '';
                editActivityModal.classList.remove('hidden');
            }
        }
        
        if (viewPlagaImageBtn) { 
            viewerModalTitle.textContent = "Reporte de Plaga"; 
            modalReportImage.src = viewPlagaImageBtn.dataset.url; 
            imageViewerModal.classList.remove('hidden'); 
        }

        if (addPlagaBtn) {
            document.getElementById('plaga-fecha').valueAsDate = new Date();
            document.getElementById('plaga-tipo').value = '';
            document.getElementById('plaga-descripcion').value = '';
            plagaPreview.src = '';
            plagaPreviewContainer.classList.add('hidden');
            newPlagaImageBase64 = null;
            plagaImageInput.value = '';
            plagaReportModal.classList.remove('hidden');
        }
    });

    /**
     * Guardar Evidencia de Actividad (Llama a /registroactividades)
     */
    saveActivityBtn.addEventListener('click', async () => {
        if (!currentActivityId) return;

        const comentario = activityComment.value;
        if (!comentario && !newActivityImageBase64) {
            alert("Debes añadir un comentario o una imagen como evidencia.");
            return;
        }

        const registroActividad = {
            idTarea: parseInt(currentActivityId),
            imagen: newActivityImageBase64, 
            descripcion: comentario
        };

        try {
            // 1. Enviar evidencia
            await fetchWithToken(`/registroactividades/`, {
                method: 'POST',
                body: JSON.stringify([registroActividad]) 
            });

            // --- ★ CORRECCIÓN ★ ---
            // 2. Actualizar estado de la tarea a "Completada" (ID 2)
            await fetchWithToken(`/tarea/${currentActivityId}/2`, {
                method: 'PATCH'
            });

            // 3. Ocultar modal y recargar
            editActivityModal.classList.add('hidden');
            successModal.classList.remove('hidden');
            setTimeout(() => successModal.classList.add('hidden'), 2000);

            // Recargar solo las tareas y re-renderizar
            const allTasks = await fetchWithToken(`/tarea`);
            projectTasks = allTasks.filter(task => task.idPlan == currentProject.idPlan);
            renderTabs(); // Re-renderiza la pestaña de actividades

        } catch (error) {
            console.error("Error al guardar evidencia:", error);
            alert("Error al guardar la evidencia. Verifique la consola.");
        }
    });
    
    // (savePlagaBtn y manejo de inputs de imagen sin cambios)
    savePlagaBtn.addEventListener('click', async () => {
        const tipo = document.getElementById('plaga-tipo').value;
        const descripcion = document.getElementById('plaga-descripcion').value;
        const fecha = document.getElementById('plaga-fecha').value;

        if (!tipo || !descripcion || !fecha) {
            alert("Debe rellenar la fecha, el tipo y la descripción de la plaga.");
            return;
        }

        const reportePlaga = {
            idPlan: currentProject.idPlan,
            fechaReporte: new Date(fecha).toISOString(),
            tipoPlaga: tipo,
            descripcion: descripcion,
            imagen: newPlagaImageBase64, 
            idEstado: 1
        };

        try {
            await fetchWithToken(`/reporteplaga`, {
                method: 'POST',
                body: JSON.stringify(reportePlaga)
            });

            plagaReportModal.classList.add('hidden');
            successModal.classList.remove('hidden');
            setTimeout(() => successModal.classList.add('hidden'), 2000);

            await loadProjectData(currentProject.idPlan);
            renderProject(); 

        } catch (error) {
            console.error("Error al guardar reporte de plaga:", error);
            alert("Error al guardar el reporte. Verifique la consola.");
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
            if (success) {
                renderProject();
                projectContainer.classList.remove('content-hidden');
            } else {
                projectContainer.classList.remove('content-hidden');
            }
        } else {
            window.location.href = 'proyectos-lista.html';
        }
    }

    initialize();
});