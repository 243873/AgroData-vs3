document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. VERIFICACIÓN DE USUARIO Y ESTADO DE LA APLICACIÓN ---
    const currentUser = JSON.parse(localStorage.getItem('usuarioActual'));
    if (!currentUser || !currentUser.token) { 
        window.location.href = '/index.html'; 
        return; 
    }
    const authToken = currentUser.token;
    const API_BASE_URL = "http://localhost:7000"; 

    let currentProject = null; 
    let projectTasks = [];     
    let currentActivityId = null; 
    let newActivityImageBase64 = null;
    let newPlagaImageBase64 = null;

    const estadoMap = { 1: 'Pendiente', 2: 'Completada' };
    const HOY = new Date(); 
    HOY.setHours(0, 0, 0, 0); 

    // --- 2. SELECCIÓN DE ELEMENTOS DEL DOM ---
    const projectContainer = document.querySelector('.project-container');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const projectTitle = document.getElementById('project-title');
    
    // --- ★ MODIFICACIÓN: Nuevos selectores de Pestañas ---
    const infoView = document.getElementById('info-view');
    const actividadesView = document.getElementById('actividades-view');
    // const reporteView = document.getElementById('reporte-view'); // No existe en el HTML del cliente
    
    // (Modales y sus contenidos no cambian)
    const editActivityModal = document.getElementById('edit-activity-modal');
    const imageViewerModal = document.getElementById('image-viewer-modal');
    const plagaReportModal = document.getElementById('plaga-report-modal');
    const successModal = document.getElementById('success-modal');
    const modalActivityTitle = document.getElementById('modal-activity-title');
    const activityComment = document.getElementById('activity-comment');
    const activityImageInput = document.getElementById('activity-image-input');
    const uploadImageButton = document.getElementById('upload-image-button');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveActivityBtn = document.getElementById('save-activity-btn');
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
    // (fetchWithToken, fetchUserProfile, loadProjectData no cambian)
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
            // Busca el plan basado en idPlan (de la URL) e idUsuario (del token)
            currentProject = allProjects.find(p => p.idPlan == projectId && p.idUsuario == currentUser.id);
            
            if (!currentProject) {
                throw new Error('Proyecto no encontrado o no te pertenece.');
            }
            
            // Busca las tareas (la API ya filtra por usuario)
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
    
    function renderProject() {
        const cultivosNombres = currentProject.cultivoPorSolicitud.map(c => c.nombreCultivo).join(', ');
        projectTitle.textContent = `Plan de Cultivo: ${cultivosNombres}`;
        
        renderGeneralInfo();
        renderActividadesPane(); // Esto ahora incluye las plagas
        // (No se llama a renderReportePane)
        initializeTabNavigation(); // Activar los listeners de las pestañas
    }
    
    function renderGeneralInfo() {
        // Esta función ahora renderiza en 'infoView'
        const cultivosHtml = currentProject.cultivoPorSolicitud.map(c => 
            `<span class="tag">${c.nombreCultivo}</span>`
        ).join('');
        
        // --- MODIFICACIÓN: Se añade un nuevo info-card para el botón de reportar plaga ---
        infoView.innerHTML = `
            <div class="info-grid">
                <div class="info-card">
                    <h4>Detalles del Cliente</h4>
                    <p><strong>Nombre:</strong> ${currentProject.nombre} ${currentProject.apellidoPaterno}</p>
                    <p><strong>Ubicación:</strong> ${currentProject.direccionTerreno}</p>
                </div>
                
                <div class="info-card">
                    <h4>Datos de la Asesoría</h4>
                    <p><strong>Objetivo/Motivo:</strong> ${currentProject.motivoAsesoria}</p>
                    <p><strong>Observaciones Agrónomo:</strong> ${currentProject.observaciones || 'Sin observaciones'}</p>
                    <p><strong>Superficie:</strong> ${currentProject.superficieTotal} hectáreas</p>
                    <p><strong>Cultivos:</strong> ${cultivosHtml}</p>
                </div>

                <div class="info-card full-width" id="report-plaga-card">
                    <h4>Reportar Problema</h4>
                    <p>¿Detectaste una plaga o enfermedad? Infórmanos para asignar una actividad de revisión.</p>
                    <button id="add-plaga-btn-info" class="btn btn-danger" style="width: 100%;">Registrar Reporte de Plaga</button>
                </div>
            </div>
        `;
    }

    function renderActividadesPane() {
        let actividadesHTML = `
            <div class="container-header">
                <h4>Actividades del Plan</h4>
            </div>
        `;
        
        if (projectTasks && projectTasks.length > 0) {
            actividadesHTML += projectTasks.map(act => {
                let estadoNombre = estadoMap[act.idEstado] || 'Desconocido';
                let estadoClass = `status-${estadoNombre.toLowerCase().replace(/[\s()]/g, '-')}`;
                let buttonHtml = '';
                
                const fechaVencimiento = new Date(act.fechaVencimiento + 'T00:00:00');
                const isAtrasada = act.idEstado === 1 && fechaVencimiento < HOY;

                if (isAtrasada) {
                    estadoNombre = 'Atrasada';
                    estadoClass = 'status-atrasada';
                }

                if (act.idEstado === 1) { // Pendiente o Atrasada
                    buttonHtml = `<button class="btn btn-primary btn-edit" data-id="${act.idTarea}">Registrar Evidencia</button>`;
                } else if (act.idEstado === 2) { // Completada
                    buttonHtml = `<button class="btn btn-primary" style="background-color: #28a745; border-color: #28a745;" disabled>Completada</button>`;
                }

                // Usamos la clase 'activity-item' del agrónomo
                return `
                    <div class="activity-item"> 
                        <div class="activity-info">
                            <strong>${act.nombreTarea}</strong>
                            <p>Estado: <span class="${estadoClass}">${estadoNombre}</span></p>
                            <p>Vence: ${act.fechaVencimiento}</p>
                        </div>
                        <div class="activity-actions">
                            ${buttonHtml}
                        </div>
                    </div>`;
            }).join('');
        } else {
            actividadesHTML += '<p>Aún no hay actividades planificadas para este proyecto.</p>';
        }

        // --- MODIFICACIÓN: Se elimina el botón "Registrar Avistamiento" de esta sección ---
        actividadesHTML += `
            <div class="container-header" style="margin-top: 30px;">
                <h4>Historial de Reportes de Plaga</h4>
            </div>
            <div id="plagas-list">
                ${currentProject.reportePlagas.length === 0 ? '<p>No hay reportes de plaga para este plan.</p>' : 
                    currentProject.reportePlagas.map(plaga => `
                        <div class="plaga-item">
                            <p><strong>Tipo:</strong> ${plaga.tipoPlaga}</p>
                            <p><strong>Descripción:</strong> ${plaga.descripcion}</p>
                            <p><strong>Fecha:</strong> ${new Date(plaga.fechaReporte).toLocaleDateString()}</p>
                            ${plaga.imagen ? `<button class="btn btn-secondary btn-sm view-plaga-image" data-url="${plaga.imagen}">Ver Imagen</button>` : ''}
                        </div>
                    `).join('')
                }
            </div>
        `;

        actividadesView.innerHTML = actividadesHTML;
    }

    // (Se elimina renderReportePane)
    
    function initializeTabNavigation() {
        const tabContainer = document.querySelector('.tab-navigation');
        if (!tabContainer) return;

        tabContainer.addEventListener('click', (e) => {
            if (e.target.matches('.tab-btn')) {
                tabContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
                
                const tabId = e.target.dataset.tab;
                e.target.classList.add('active');
                document.getElementById(`${tabId}-view`).classList.remove('hidden');
            }
        });
    }
    
    // --- 5. MANEJO DE EVENTOS (MODALES) ---
    
    // MODIFICACIÓN: Se usa 'projectContainer' para delegar eventos,
    // ya que el botón de plaga ahora está en el info-view.
    projectContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const addPlagaBtn = e.target.closest('#add-plaga-btn-info'); // Escucha el nuevo botón en info-view
        const viewPlagaImageBtn = e.target.closest('.view-plaga-image'); // Escucha el botón de ver imagen

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

        if (addPlagaBtn) {
            // Abre el modal de reporte de plaga
            document.getElementById('plaga-fecha').valueAsDate = new Date();
            document.getElementById('plaga-tipo').value = '';
            document.getElementById('plaga-descripcion').value = '';
            plagaPreview.src = '';
            plagaPreviewContainer.classList.add('hidden');
            newPlagaImageBase64 = null;
            plagaImageInput.value = '';
            plagaReportModal.classList.remove('hidden');
        }

        if (viewPlagaImageBtn) { 
            // Abre el modal para ver la imagen de la plaga
            viewerModalTitle.textContent = "Reporte de Plaga"; 
            modalReportImage.src = viewPlagaImageBtn.dataset.url; 
            imageViewerModal.classList.remove('hidden'); 
        }
    });

    // =================================================================
    // --- INICIO DE LA CORRECCIÓN ---
    // =================================================================
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
            // 1. Registrar la evidencia
            await fetchWithToken(`/registroactividades/`, {
                method: 'POST',
                body: JSON.stringify([registroActividad]) 
            });

            // 2. Marcar la tarea como completada (estado 2)
            await fetchWithToken(`/tarea/${currentActivityId}/2`, {
                method: 'PATCH'
            });

            // 3. Ocultar modales y mostrar éxito
            editActivityModal.classList.add('hidden');
            successModal.classList.remove('hidden');
            setTimeout(() => successModal.classList.add('hidden'), 2000);

            // 4. Recargar la lista de tareas
            const allTasks = await fetchWithToken(`/tarea`);
            projectTasks = allTasks.filter(task => task.idPlan == currentProject.idPlan);
            renderActividadesPane(); // Solo re-renderiza la pestaña de actividades

        } catch (error) { // <-- ¡ESTE ES EL BLOQUE QUE FALTABA!
            console.error("Error al guardar evidencia:", error);
            alert("Error al guardar la evidencia. Verifique la consola.");
        }
    });
    // =================================================================
    // --- FIN DE LA CORRECCIÓN ---
    // =================================================================
    
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
            // --- MODIFICACIÓN: Corrección de formato de fecha ---
            // fechaReporte: new Date(fecha).toISOString(), // Esto envía UTC
            fechaReporte: `${fecha}T00:00:00`, // Envía la fecha local
            tipoPlaga: tipo,
            descripcion: descripcion,
            imagen: newPlagaImageBase64, 
            idEstado: 1,
            idTarea: 0 // Se envía 0 o null si no está ligada a una tarea específica
        };

        try {
            await fetchWithToken(`/reporteplaga`, {
                method: 'POST',
                body: JSON.stringify(reportePlaga)
            });

            plagaReportModal.classList.add('hidden');
            successModal.classList.remove('hidden');
            setTimeout(() => successModal.classList.add('hidden'), 2000);

            // Recargar todo el proyecto para que la lista de plagas se actualice
            await loadProjectData(currentProject.idPlan);
            // Re-renderizar ambas pestañas
            renderGeneralInfo();
            renderActividadesPane();

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