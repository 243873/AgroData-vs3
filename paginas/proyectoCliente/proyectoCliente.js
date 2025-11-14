document.addEventListener('DOMContentLoaded', () => {
    // --- 1. VERIFICACIÓN DE USUARIO Y ESTADO DE LA APLICACIÓN ---
    const currentUser = JSON.parse(localStorage.getItem('usuarioActual'));
    if (!currentUser || !currentUser.token) { 
        window.location.href = '/index.html'; 
        return; 
    }
    const authToken = currentUser.token;
    const API_BASE_URL = "http://localhost:7000"; // Asegúrate que el puerto es 8001

    let currentProject = null; // Guardará el PlanCultivo
    let projectTasks = [];     // Guardará las Tareas
    let currentActivityId = null; // El idTarea que se está editando
    let newActivityImageBase64 = null;
    let newPlagaImageBase64 = null;

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
    
    // Contenido Modal Visor
    const viewerModalTitle = document.getElementById('viewer-modal-title');
    const modalReportImage = document.getElementById('modal-report-image');
    const closeImageViewerBtn = document.getElementById('close-image-viewer-btn');

    // Contenido Modal Plaga
    const btnUploadPlaga = document.getElementById('btn-upload-plaga');
    const plagaImageInput = document.getElementById('plaga-image-input');
    const plagaPreviewContainer = document.getElementById('plaga-preview-container');
    const plagaPreview = document.getElementById('plaga-preview');
    const cancelPlagaBtn = document.getElementById('cancel-plaga-btn');
    const savePlagaBtn = document.getElementById('save-plaga-btn');


    // --- 3. LÓGICA DE DATOS (API) ---

    /**
     * Función 'fetch' personalizada que añade el token
     */
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
            throw new Error(`Error de API: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return response.text();
        }
    }

    /**
     * Carga el perfil del usuario para obtener el nombre
     */
    async function fetchUserProfile() {
        try {
            const userProfile = await fetchWithToken(`/perfil/${currentUser.id}`);
            welcomeMessage.textContent = `Bienvenido, ${userProfile.nombre}`;
        } catch (error) {
            console.error("Error al cargar perfil:", error);
            welcomeMessage.textContent = `Bienvenido, Usuario (ID: ${currentUser.id})`;
        }
    }

    /**
     * Carga el proyecto, sus tareas y sus reportes de plaga desde la API
     */
    async function loadProjectData(projectId) {
        try {
            // 1. Obtener el Plan de Cultivo
            const allProjects = await fetchWithToken(`/obtenerPlanCultivos`);
            currentProject = allProjects.find(p => p.idPlan == projectId);
            
            if (!currentProject) throw new Error('Proyecto no encontrado.');

            // 2. Obtener TODAS las tareas del usuario (API ya filtra por usuario rol=2)
            const allTasks = await fetchWithToken(`/tarea`);
            
            // 3. Filtrar las tareas que pertenecen a ESTE plan
            projectTasks = allTasks.filter(task => task.idPlan == currentProject.idPlan);

            return true;
        } catch (error) {
            console.error("Error cargando datos del proyecto:", error);
            projectContainer.innerHTML = `
                <div style="background-color: #FFFFFF; border-radius: 12px; padding: 40px; text-align: center; color: #666;">
                    <h2>Error al cargar el proyecto</h2>
                    <p>${error.message}. (Probable error de CORS o ID de proyecto inválido)</p>
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
        renderTabs();
    }
    
    function renderGeneralInfo() {
        // Mapeamos desde el modelo PlanCultivo
        projectGeneralInfo.querySelector('.info-grid').innerHTML = `
            <div>
                <div class="info-group"><label>Superficie Total:</label><p>${currentProject.superficieTotal} hectáreas</p></div>
                <div class="info-group"><label>Ubicación:</label><p>${currentProject.direccionTerreno}</p></div>
                <div class="info-group"><label>Agricultor:</label><p>${currentProject.nombre} ${currentProject.apellidoPaterno}</p></div>
                <div class="info-group"><label>Motivo de la Asesoría:</label><p>${currentProject.motivoAsesoria}</p></div>
                <div class="info-group"><label>Fecha Inicio:</label><p>${currentProject.fechaInicio}</p></div>
                <div class="info-group"><label>Fecha Fin:</label><p>${currentProject.fechaFin}</p></div>
                <div class="info-group"><label>Observaciones del Agrónomo:</label><p>${currentProject.observaciones || 'Sin observaciones.'}</p></div>
            </div>
        `;
    }

    /**
     * LÓGICA MODIFICADA
     * Creamos pestañas para "Actividades" y "Plagas".
     */
    function renderTabs() {
        cropTabNavigation.innerHTML = '';
        cropTabContent.innerHTML = '';

        // 1. Crear Pestaña "Actividades"
        cropTabNavigation.innerHTML += `<button class="tab-btn active" data-target="tab-actividades">Actividades</button>`;
        cropTabContent.innerHTML += `<div id="tab-actividades" class="tab-pane active">${renderActividadesPane()}</div>`;

        // 2. Crear Pestaña "Reportes de Plaga"
        cropTabNavigation.innerHTML += `<button class="tab-btn" data-target="tab-plagas">Reportes de Plaga</button>`;
        cropTabContent.innerHTML += `<div id="tab-plagas" class="tab-pane">${renderPlagasPane()}</div>`;

        addTabListeners();
    }

    /**
     * Renderiza el contenido de la pestaña "Actividades"
     */
    function renderActividadesPane() {
        let actividadesHTML = '';
        if (projectTasks && projectTasks.length > 0) {
            
            // Mapeo de ID de estado a nombre (basado en catalogoEstado)
            const estadoMap = { 1: 'Pendiente', 2: 'Aceptada', 3: 'Pendiente', 4: 'Completada', 5: 'Rechazada' };
            
            actividadesHTML = projectTasks.map(act => {
                // Mapeamos desde el modelo Tarea
                const estadoNombre = estadoMap[act.idEstado] || 'Desconocido';
                const estadoClass = `status-${estadoNombre.toLowerCase()}`;
                
                return `
                    <div class="activity-card">
                        <div class="activity-header">
                            <h5>${act.nombreTarea}</h5>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <div class="status-badge ${estadoClass}">${estadoNombre}</div>
                                <button class="btn btn-primary btn-edit" data-id="${act.idTarea}">Registrar Evidencia</button>
                            </div>
                        </div>
                        <p>${act.descripcion || 'Sin descripción.'}</p>
                        <div class="activity-dates">
                            <span><strong>Inicio:</strong> ${act.fechaInicio}</span>
                            <span><strong>Vencimiento:</strong> ${act.fechaVencimiento}</span>
                        </div>
                        <div class="evidence-box">
                            <span><strong>Evidencia:</strong> (Añada evidencia haciendo clic en el botón 'Registrar Evidencia')</span>
                        </div>
                    </div>`;
            }).join('');
        } else {
            actividadesHTML = '<p>Aún no hay actividades planificadas para este proyecto.</p>';
        }

        return `<h4>Actividades del Plan</h4>
                <div class="activities-list">${actividadesHTML}</div>`;
    }

     /**
     * Renderiza el contenido de la pestaña "Reportes de Plaga"
     */
    function renderPlagasPane() {
        let plagaHTML = '';
        const reportes = currentProject.reportePlagas; //

        if (reportes && reportes.length > 0) {
            plagaHTML = reportes.map(reporte => `
                <div class="info-group"><label>Fecha de reporte:</label><p>${new Date(reporte.fechaReporte).toLocaleString()}</p></div>
                <div class="info-group"><label>Tipo de plaga:</label><p>${reporte.tipoPlaga}</p></div>
                <div class="info-group"><label>Descripción:</label><p>${reporte.descripcion}</p></div>
                ${reporte.imagen ? `<button class="btn btn-secondary view-plaga-image" data-url="${reporte.imagen}">Ver Imagen del Reporte</button>` : ''}
                <hr style="margin: 15px 0;">
            `).join('');
        }
        
        // Añadir el botón para crear un nuevo reporte
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
    
    document.querySelector('.main-content').addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const viewPlagaImageBtn = e.target.closest('.view-plaga-image');
        const addPlagaBtn = e.target.closest('.btn-add-plaga');

        // Botón "Registrar Evidencia"
        if (editBtn) {
            currentActivityId = editBtn.dataset.id; // Este es el idTarea
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
        
        // Botón "Ver Imagen del Reporte"
        if (viewPlagaImageBtn) { 
            viewerModalTitle.textContent = "Reporte de Plaga"; 
            modalReportImage.src = viewPlagaImageBtn.dataset.url; 
            imageViewerModal.classList.remove('hidden'); 
        }

        // Botón "Crear Nuevo Reporte de Plaga"
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

        // 1. Preparar el payload
        const registroActividad = {
            idTarea: parseInt(currentActivityId),
            imagen: newActivityImageBase64, // (El backend debe manejar Base64)
            descripcion: comentario
        };

        try {
            // 2. Llamar a la API de Registro
            // El backend espera un Array
            await fetchWithToken(`/registroactividades/`, {
                method: 'POST',
                body: JSON.stringify([registroActividad]) 
            });

            // 3. Actualizar estado de la tarea a "Completada" (ID 4)
            await fetchWithToken(`/tarea/${currentActivityId}/4`, {
                method: 'PATCH'
            });

            // 4. Ocultar modal y recargar
            editActivityModal.classList.add('hidden');
            successModal.classList.remove('hidden');
            setTimeout(() => successModal.classList.add('hidden'), 2000);

            // Recargar solo las tareas y re-renderizar
            const allTasks = await fetchWithToken(`/tarea`);
            projectTasks = allTasks.filter(task => task.idPlan == currentProject.idPlan);
            renderTabs();

        } catch (error) {
            console.error("Error al guardar evidencia:", error);
            alert("Error al guardar la evidencia. (Probable error de CORS)");
        }
    });
    
    /**
     * Guardar Reporte de Plaga (Llama a /reporteplaga)
     */
    savePlagaBtn.addEventListener('click', async () => {
        const tipo = document.getElementById('plaga-tipo').value;
        const descripcion = document.getElementById('plaga-descripcion').value;

        if (!tipo || !descripcion) {
            alert("Debe rellenar el tipo y la descripción de la plaga.");
            return;
        }

        // 1. Preparar payload
        const reportePlaga = {
            idPlan: currentProject.idPlan,
            fechaReporte: new Date().toISOString(),
            tipoPlaga: tipo,
            descripcion: descripcion,
            imagen: newPlagaImageBase64, // (El backend debe manejar Base64)
            idEstado: 1 // 1 = Pendiente
        };

        try {
            // 2. Llamar a la API
            await fetchWithToken(`/reporteplaga`, {
                method: 'POST',
                body: JSON.stringify(reportePlaga)
            });

            // 3. Ocultar modal y recargar
            plagaReportModal.classList.add('hidden');
            successModal.classList.remove('hidden');
            setTimeout(() => successModal.classList.add('hidden'), 2000);

            // Recargar el proyecto completo para ver el nuevo reporte
            await loadProjectData(currentProject.idPlan);
            renderProject();

        } catch (error) {
            console.error("Error al guardar reporte de plaga:", error);
            alert("Error al guardar el reporte. (Probable error de CORS)");
        }
    });

    // --- Manejo de inputs de imagen ---
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

    // --- Botones de cerrar modales ---
    cancelEditBtn.addEventListener('click', () => editActivityModal.classList.add('hidden'));
    closeImageViewerBtn.addEventListener('click', () => imageViewerModal.classList.add('hidden'));
    cancelPlagaBtn.addEventListener('click', () => plagaReportModal.classList.add('hidden'));

    // --- 6. INICIALIZACIÓN ---
    
    async function initialize() {
        // 1. Cargar el nombre de usuario
        await fetchUserProfile();

        // 2. Cargar los datos del proyecto
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('id');
        
        if (projectId) {
            const success = await loadProjectData(projectId);
            if (success) {
                renderProject();
                projectContainer.classList.remove('content-hidden');
            }
        } else {
            window.location.href = 'proyectos-lista.html';
        }
    }

    initialize();
});