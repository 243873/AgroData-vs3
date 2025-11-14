document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. CONFIGURACIÓN INICIAL Y AUTENTICACIÓN ---
    const API_BASE_URL = 'http://localhost:7000';
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual'));

    // Redirige si el usuario no es agrónomo (rol 1) o no tiene token
    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        console.error("Acceso denegado o sesión inválida.");
        localStorage.clear();
        window.location.href = '../../index.html';
        return;
    }
    
    const authToken = authInfo.token;

    // --- 2. OBTENER IDs DE LA URL ---
    // Obtenemos los IDs del plan y la solicitud desde la URL (ej: ?idPlan=1&idSolicitud=1)
    const urlParams = new URLSearchParams(window.location.search);
    const idPlan = parseInt(urlParams.get('idPlan'));
    const idSolicitud = parseInt(urlParams.get('idSolicitud'));

    if (!idPlan || !idSolicitud) {
        console.error("No se proporcionaron idPlan o idSolicitud en la URL.");
        document.getElementById('project-container').innerHTML = '<h2>Error: Faltan parámetros en la URL.</h2>';
        return;
    }

    // --- 3. ELEMENTOS DEL DOM ---
    const projectTitle = document.getElementById('project-title');
    const welcomeMessage = document.getElementById('welcomeMessage');

    // Vistas de Pestañas
    const infoView = document.getElementById('info-view');
    const actividadesView = document.getElementById('actividades-view');
    const reporteView = document.getElementById('reporte-view');

    // Modales
    const infoModal = document.getElementById('info-modal');
    const activityModal = document.getElementById('activity-modal');
    const deleteActivityModal = document.getElementById('delete-activity-modal');

    // Referencias a los datos cargados
    let currentPlan = null;
    let currentSolicitud = null;
    let currentActivities = [];

    // --- 4. FUNCIÓN HELPER DE FETCH ---
    async function fetchWithAuth(url, options = {}) {
        const headers = { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json', // Especificamos JSON por defecto
            ...(options.headers || {}) 
        };
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.error("Token inválido o expirado. Redirigiendo a login.");
                localStorage.clear();
                window.location.href = '../../index.html';
            }
            throw new Error(`Error de red: ${response.status} ${response.statusText}`);
        }
        
        // Maneja respuestas que no tienen contenido (como 200 OK en un PUT/DELETE)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return response.text(); // Devuelve texto si no es JSON
        }
    }

    // --- 5. LÓGICA DE CARGA DE DATOS ---

    async function loadProfileAndGreeting() {
        try {
            const user = await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });
            if (welcomeMessage) welcomeMessage.textContent = `Bienvenido, ${user.nombre}`;
        } catch (error) {
            console.error('Error al cargar saludo:', error);
            if (welcomeMessage) welcomeMessage.textContent = `Bienvenido, Agrónomo`;
        }
    }

    async function loadProjectData() {
        try {
            // 1. Cargar el Plan de Cultivo (contiene la mayoría de datos)
            // Usamos el endpoint de lista, pero filtraremos por el ID del plan
            const allPlans = await fetchWithAuth(`${API_BASE_URL}/obtenerPlanCultivos`);
            currentPlan = allPlans.find(p => p.idPlan === idPlan);
            
            if (!currentPlan) throw new Error("Plan de cultivo no encontrado.");

            // 2. Cargar la Solicitud de Asesoría (para detalles extra del formulario)
            currentSolicitud = await fetchWithAuth(`${API_BASE_URL}/solicitudasesoria/${idSolicitud}`);

            // 3. Renderizar los datos
            projectTitle.textContent = `Detalle del Plan: ${currentPlan.motivoAsesoria.substring(0, 40)}...`;
            renderInfoTab();

            // 4. Cargar datos de las otras pestañas
            loadActivities();
            loadReport();

        } catch (error) {
            console.error("Error fatal al cargar datos del proyecto:", error);
            projectTitle.textContent = "Error al cargar proyecto";
            infoView.innerHTML = `<p class="error-message">No se pudieron cargar los datos. ${error.message}</p>`;
        }
    }

    // --- 6. RENDERIZADO DE PESTAÑAS ---

    function renderInfoTab() {
        if (!currentPlan || !currentSolicitud) return;

        // Formatear cultivos
        const cultivosHtml = currentPlan.cultivoPorSolicitud.map(c => 
            `<span class="tag">${c.nombreCultivo}</span>`
        ).join('');
        
        // Formatear datos de la solicitud
        const solicitud = currentSolicitud;

        infoView.innerHTML = `
            <div class="info-grid">
                <div class="info-card">
                    <h4>Detalles del Cliente</h4>
                    <p><strong>Nombre:</strong> ${currentPlan.nombre} ${currentPlan.apellidoPaterno}</p>
                    <p><strong>Ubicación:</strong> ${currentPlan.direccionTerreno}</p>
                </div>
                
                <div class="info-card">
                    <h4>Datos de la Asesoría</h4>
                    <p><strong>Objetivo/Motivo:</strong> ${currentPlan.motivoAsesoria}</p>
                    <p><strong>Observaciones Agrónomo:</strong> ${currentPlan.observaciones || 'Sin observaciones'}</p>
                    <p><strong>Superficie:</strong> ${currentPlan.superficieTotal} hectáreas</p>
                    <p><strong>Cultivos:</strong> ${cultivosHtml}</p>
                    <button id="edit-info-btn" class="btn btn-secondary">Editar Observaciones</button>
                </div>

                <div class="info-card full-width">
                    <h4>Información de la Solicitud Original</h4>
                    <div class="solicitud-grid">
                        <p><strong>Tipo de Riego:</strong> ${solicitud.nombreRiego || 'No especificado'}</p>
                        <p><strong>Usa Maquinaria:</strong> ${solicitud.usoMaquinaria ? 'Sí' : 'No'}</p>
                        ${solicitud.usoMaquinaria ? `<p><strong>Maquinaria:</strong> ${solicitud.nombreMaquinaria}</p>` : ''}
                        <p><strong>Tiene Plaga:</strong> ${solicitud.tienePlaga ? 'Sí' : 'No'}</p>
                        ${solicitud.tienePlaga ? `<p><strong>Descripción Plaga:</strong> ${solicitud.descripcionPlaga}</p>` : ''}
                    </div>
                </div>
            </div>
        `;

        // Asignar evento al botón de editar
        document.getElementById('edit-info-btn').addEventListener('click', () => {
            // Llenar el modal con datos existentes
            document.getElementById('info-objetivo').value = currentPlan.motivoAsesoria;
            document.getElementById('info-observaciones').value = currentPlan.observaciones; // Nuevo campo
            infoModal.classList.remove('hidden');
        });
    }

    async function loadActivities() {
        try {
            const allTasks = await fetchWithAuth(`${API_BASE_URL}/tarea`);
            currentActivities = allTasks.filter(task => task.idPlan === idPlan);
            renderActivitiesTab();
        } catch (error) {
            console.error("Error al cargar actividades:", error);
            actividadesView.innerHTML = `<p class="error-message">Error al cargar actividades.</p>`;
        }
    }

    function renderActivitiesTab() {
        let activitiesHtml = `
            <div class="container-header">
                <h4>Actividades del Plan</h4>
                <button id="add-activity-btn" class="btn btn-primary">Añadir Actividad</button>
            </div>
        `;

        if (currentActivities.length === 0) {
            activitiesHtml += '<p>No hay actividades asignadas a este plan.</p>';
        } else {
            activitiesHtml += currentActivities.map(task => `
                <div class="activity-item">
                    <div class="activity-info">
                        <strong>${task.nombreTarea}</strong>
                        <p>Estado: ${task.idEstado}</p>
                        <p>Vence: ${task.fechaVencimiento}</p>
                    </div>
                    <div class="activity-actions">
                        <button class="btn btn-secondary btn-edit-task" data-task-id="${task.idTarea}">Editar</button>
                        <button class="btn btn-danger btn-delete-task" data-task-id="${task.idTarea}">Eliminar</button>
                    </div>
                </div>
            `).join('');
        }
        
        // Sección de Reporte de Plagas
        activitiesHtml += `
            <div class="container-header" style="margin-top: 30px;">
                <h4>Reporte de Plagas</h4>
                <button id="add-plaga-btn" class="btn btn-primary">Registrar Avistamiento</button>
            </div>
            <div id="plagas-list">
                ${currentPlan.reportePlagas.length === 0 ? '<p>No hay reportes de plaga para este plan.</p>' : 
                    currentPlan.reportePlagas.map(plaga => `
                        <div class="plaga-item">
                            <p><strong>Tipo:</strong> ${plaga.tipoPlaga}</p>
                            <p><strong>Descripción:</strong> ${plaga.descripcion}</p>
                            <p><strong>Fecha:</strong> ${new Date(plaga.fechaReporte).toLocaleDateString()}</p>
                        </div>
                    `).join('')
                }
            </div>
        `;

        actividadesView.innerHTML = activitiesHtml;

        // Asignar evento al botón de "Añadir Actividad"
        document.getElementById('add-activity-btn').addEventListener('click', () => {
            document.getElementById('activity-modal-title').textContent = "Agregar nueva actividad";
            document.getElementById('activity-form').reset();
            activityModal.dataset.mode = 'add'; // Usamos un dataset para saber si es 'add' o 'edit'
            activityModal.classList.remove('hidden');
        });
        
        // TODO: Añadir lógica para el botón 'add-plaga-btn'
        document.getElementById('add-plaga-btn').addEventListener('click', () => {
            alert('Funcionalidad de "Registrar Avistamiento" no implementada en este script.');
            // Aquí abrirías un modal para POST a /reporteplaga
        });
    }

    async function loadReport() {
        try {
            const reporte = await fetchWithAuth(`${API_BASE_URL}/obtenerReporteDesempeno/${idPlan}`);
            renderReportTab(reporte);
        } catch (error) {
            console.error("Error al cargar reporte:", error);
            reporteView.innerHTML = `<p class="error-message">No se pudo cargar el reporte de desempeño.</p>`;
        }
    }

    function renderReportTab(reporte) {
        if (!reporte) {
            reporteView.innerHTML = '<p>No hay datos para generar un reporte.</p>';
            return;
        }

        reporteView.innerHTML = `
            <div class="report-grid">
                <div class="report-card">
                    <h4>Tareas Totales</h4>
                    <p class="report-value">${reporte.totalTareas}</p>
                </div>
                <div class="report-card">
                    <h4>Completadas</h4>
                    <p class="report-value success">${reporte.tareasCompletadas}</p>
                </div>
                <div class="report-card">
                    <h4>Pendientes</h4>
                    <p class="report-value warning">${reporte.tareasPendientes}</p>
                </div>
                <div class="report-card">
                    <h4>Aceptadas (Revisadas)</h4>
                    <p class="report-value info">${reporte.tareasAceptadas}</p>
                </div>
                <div class="report-card full-width">
                    <h4>Progreso General</h4>
                    <div class="progress-bar-container large">
                        <label>Avance: ${reporte.porcentageCompletadas.toFixed(0)}%</label>
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: ${reporte.porcentageCompletadas}%;"></div>
                        </div>
                    </div>
                </div>
                 <div class="report-card full-width">
                    <h4>Observaciones del Reporte</h4>
                    <p>${reporte.observaciones || 'No hay observaciones registradas.'}</p>
                    <button id="edit-report-obs-btn" class="btn btn-secondary">Registrar/Editar Observaciones</button>
                </div>
            </div>
        `;
        
        // TODO: Añadir lógica para 'edit-report-obs-btn'
        // Esto llamaría a POST /registrarReporteDesempeno
        document.getElementById('edit-report-obs-btn').addEventListener('click', () => {
             alert('Funcionalidad de "Registrar Observaciones" no implementada en este script.');
        });
    }


    // --- 7. MANEJO DE EVENTOS (PESTAÑAS Y MODALES) ---

    // Navegación por pestañas
    document.querySelector('.tab-navigation').addEventListener('click', (e) => {
        if (e.target.matches('.tab-btn')) {
            // Quitar 'active' de todos los botones y tabs
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));

            // Añadir 'active' al botón y tab correctos
            const tabId = e.target.dataset.tab;
            e.target.classList.add('active');
            document.getElementById(`${tabId}-view`).classList.remove('hidden');
        }
    });

    // --- Lógica Modal Info Proyecto ---
    document.getElementById('save-info-btn').addEventListener('click', async () => {
        const objetivo = document.getElementById('info-objetivo').value;
        const observaciones = document.getElementById('info-observaciones').value; // Nuevo

        try {
            await fetchWithAuth(`${API_BASE_URL}/planes/${idSolicitud}/${idPlan}`, {
                method: 'PUT',
                body: JSON.stringify({
                    objetivo: objetivo,
                    observaciones: observaciones 
                })
            });
            
            // Si tiene éxito, actualiza los datos locales y la UI
            currentPlan.motivoAsesoria = objetivo;
            currentPlan.observaciones = observaciones;
            renderInfoTab(); // Re-renderiza la pestaña de info
            infoModal.classList.add('hidden');
            
        } catch (error) {
            console.error("Error al guardar observaciones:", error);
            alert("Error al guardar. Verifique la consola.");
        }
    });
    document.getElementById('cancel-info-btn').addEventListener('click', () => infoModal.classList.add('hidden'));


    document.getElementById('save-activity-btn').addEventListener('click', async () => {
        const nombreTarea = document.getElementById('activity-name').value;
        const fechaVencimiento = document.getElementById('activity-end').value;

        if (!nombreTarea || !fechaVencimiento) {
            alert("El nombre y la fecha de fin son obligatorios.");
            return;
        }

        // ▼▼▼ INICIO DE LA CORRECCIÓN ▼▼▼
        // Obtenemos el ID del cliente (agricultor) desde el plan de cultivo actual.
        const idUsuarioCliente = currentPlan.idUsuario; 
        
        if (!idUsuarioCliente) {
            alert("Error: No se pudo encontrar el ID del cliente en el plan actual.");
            return;
        }
        // ▲▲▲ FIN DE LA CORRECCIÓN ▲▲▲

        const nuevaTarea = {
            idPlan: idPlan,
            nombreTarea: nombreTarea,
            fechaVencimiento: fechaVencimiento,
            fechaInicio: new Date().toISOString().split('T')[0], 
            idEstado: 1, // Asumimos 1 = Pendiente
            idUsuario: idUsuarioCliente // <-- AÑADIMOS EL ID DEL CLIENTE
        };

        try {
            await fetchWithAuth(`${API_BASE_URL}/tarea`, {
                method: 'POST',
                headers: {
                    'confirmado': 'true' // Requerido por tu TareaController
                },
                body: JSON.stringify(nuevaTarea)
            });

            activityModal.classList.add('hidden');
            loadActivities(); 

        } catch (error) {
            console.error("Error al guardar la actividad:", error);
            alert("Error al guardar. Verifique la consola.");
        }
    });
    document.getElementById('cancel-activity-btn').addEventListener('click', () => activityModal.classList.add('hidden'));

    // --- Lógica para botones de Eliminar/Editar Tarea (Delegación de eventos) ---
    actividadesView.addEventListener('click', async (e) => {
        // Botón Eliminar
        if (e.target.matches('.btn-delete-task')) {
            const taskId = e.target.dataset.taskId;
            
            // Mostrar modal de confirmación (no implementado en tu HTML, pero sería ideal)
            if (confirm("¿Estás seguro de que quieres eliminar esta tarea?")) {
                try {
                    await fetchWithAuth(`${API_BASE_URL}/tarea/${taskId}`, {
                        method: 'DELETE'
                    });
                    loadActivities(); // Recargar lista
                } catch (error) {
                    console.error("Error al eliminar tarea:", error);
                    alert("Error al eliminar la tarea.");
                }
            }
        }
        
        // Botón Editar
        if (e.target.matches('.btn-edit-task')) {
             alert('La edición de tareas no está implementada en este script.');
             // Aquí abrirías el modal de actividad en modo 'edit'
        }
    });


    // --- 8. EJECUCIÓN INICIAL ---
    await loadProfileAndGreeting();
    await loadProjectData(); // Esto carga todo lo demás

});