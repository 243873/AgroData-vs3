document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. CONFIGURACIÓN INICIAL Y AUTENTICACIÓN ---
    const API_BASE_URL = 'http://localhost:7000';
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual'));

    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        console.error("Acceso denegado o sesión inválida.");
        localStorage.clear();
        window.location.href = '../../index.html';
        return;
    }
    
    const authToken = authInfo.token;

    // --- 2. OBTENER IDs DE LA URL ---
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

    const infoView = document.getElementById('info-view');
    const actividadesView = document.getElementById('actividades-view');
    const reporteView = document.getElementById('reporte-view');

    const infoModal = document.getElementById('info-modal');
    const activityModal = document.getElementById('activity-modal');
    const deleteActivityModal = document.getElementById('delete-activity-modal'); 

    let currentPlan = null;
    let currentSolicitud = null;
    let currentActivities = [];

    // --- ★ CORRECCIÓN ★ ---
    // Mapeo de estados de TAREA simplificado
    const estadoMap = { 1: 'Pendiente', 2: 'Completada' };
    const HOY = new Date(); // Para comparar fechas de vencimiento
    HOY.setHours(0, 0, 0, 0); // Ignorar la hora

    // --- 4. FUNCIÓN HELPER DE FETCH ---
    async function fetchWithAuth(url, options = {}) {
        const headers = { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json', 
            ...(options.headers || {}) 
        };
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.error("Token inválido o expirado. Redirigiendo a login.");
                localStorage.clear();
                window.location.href = '../../index.html';
            }
            const errorText = await response.text();
            throw new Error(`Error de red: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return response.text(); 
        }
    }

    // --- 5. LÓGICA DE CARGA DE DATOS ---

    // (loadProfileAndGreeting y loadProjectData sin cambios)
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
            const allPlans = await fetchWithAuth(`${API_BASE_URL}/obtenerPlanCultivos`);
            currentPlan = allPlans.find(p => p.idPlan === idPlan);
            
            if (!currentPlan) throw new Error("Plan de cultivo no encontrado.");

            currentSolicitud = await fetchWithAuth(`${API_BASE_URL}/solicitudasesoria/${idSolicitud}`);

            projectTitle.textContent = `Detalle del Plan: ${currentPlan.motivoAsesoria.substring(0, 40)}...`;
            renderInfoTab();

            loadActivities();
            loadReport();

        } catch (error) {
            console.error("Error fatal al cargar datos del proyecto:", error);
            projectTitle.textContent = "Error al cargar proyecto";
            infoView.innerHTML = `<p class="error-message">No se pudieron cargar los datos. ${error.message}</p>`;
        }
    }

    // --- 6. RENDERIZADO DE PESTAÑAS ---

    // (renderInfoTab sin cambios)
    function renderInfoTab() {
        if (!currentPlan || !currentSolicitud) return;

        const cultivosHtml = currentPlan.cultivoPorSolicitud.map(c => 
            `<span class="tag">${c.nombreCultivo}</span>`
        ).join('');
        
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

        document.getElementById('edit-info-btn').addEventListener('click', () => {
            document.getElementById('info-objetivo').value = currentPlan.motivoAsesoria;
            document.getElementById('info-observaciones').value = currentPlan.observaciones;
            infoModal.classList.remove('hidden');
        });
    }

    // (loadActivities sin cambios)
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

    // --- ★ CORRECCIÓN: Renderizado de Tareas para Agrónomo ---
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
            activitiesHtml += currentActivities.map(task => {
                const taskJson = JSON.stringify(task).replace(/'/g, "&apos;");
                
                let estadoNombre = estadoMap[task.idEstado] || 'Desconocido';
                let estadoClass = `status-${estadoNombre.toLowerCase().replace(/[\s()]/g, '-')}`;

                // Lógica de estado visual "Atrasada"
                const fechaVencimiento = new Date(task.fechaVencimiento + 'T00:00:00');
                const isAtrasada = task.idEstado === 1 && fechaVencimiento < HOY;

                if (isAtrasada) {
                    estadoNombre = 'Atrasada';
                    estadoClass = 'status-atrasada';
                }

                // El agrónomo puede reabrir una tarea completada
                // (Se muestra "Editar" y "Eliminar" en todos los casos)
                // Opcional: añadir botón "Reabrir Tarea" si está completada
                
                return `
                <div class="activity-item">
                    <div class="activity-info">
                        <strong>${task.nombreTarea}</strong>
                        <p>Estado: <span class="${estadoClass}">${estadoNombre}</span></p>
                        <p>Vence: ${task.fechaVencimiento}</p>
                    </div>
                    <div class="activity-actions">
                        <button class="btn btn-secondary btn-edit-task" data-task-json='${taskJson}'>Editar</button>
                        <button class="btn btn-danger btn-delete-task" data-task-id="${task.idTarea}">Eliminar</button>
                    </div>
                </div>
            `}).join('');
        }
        
        // (Sección de plagas sin cambios)
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

        document.getElementById('add-activity-btn').addEventListener('click', () => {
            document.getElementById('activity-modal-title').textContent = "Agregar nueva actividad";
            document.getElementById('activity-form').reset();
            activityModal.dataset.mode = 'add';
            activityModal.dataset.editingId = ''; 
            activityModal.classList.remove('hidden');
        });
        
        document.getElementById('add-plaga-btn').addEventListener('click', () => {
            alert('Funcionalidad de "Registrar Avistamiento" no implementada en este script.');
        });
    }

    // (loadReport sin cambios)
    async function loadReport() {
        try {
            const reporte = await fetchWithAuth(`${API_BASE_URL}/obtenerReporteDesempeno/${idPlan}`);
            renderReportTab(reporte);
        } catch (error) {
            console.error("Error al cargar reporte:", error);
            reporteView.innerHTML = `<p class="error-message">No se pudo cargar el reporte de desempeño.</p>`;
        }
    }

    // --- ★ CORRECCIÓN: Renderizado del Reporte del Agrónomo ---
    function renderReportTab(reporte) {
        if (!reporte) {
            reporteView.innerHTML = '<p>No hay datos para generar un reporte.</p>';
            return;
        }

        // --- CÁLCULOS PARA LA GRÁFICA ---
        const total = reporte.totalTareas;
        // Combinamos pendientes y atrasadas para la altura máxima
        const totalPendientes = reporte.tareasPendientes + reporte.tareasAtrasadas;
        
        let hPendiente = 0;
        let hAtrasada = 0;
        let hCompletada = 0;

        // Evitar división por cero
        if (total > 0) {
            // Usamos el total de pendientes (a tiempo + atrasadas) como base si es mayor
            const maxPendiente = Math.max(totalPendientes, reporte.tareasCompletadas);
            const baseAltura = maxPendiente > 0 ? (100 / maxPendiente) : 0;
            
            // Alturas relativas
            hPendiente = (reporte.tareasPendientes / total) * 100;
            hAtrasada = (reporte.tareasAtrasadas / total) * 100;
            hCompletada = (reporte.tareasCompletadas / total) * 100;
        }

        // --- HTML DE LA GRÁFICA ---
        const chartHtml = `
            <div class="chart-section">
                <h4>Distribución de Tareas</h4>
                <div class="chart-container">
                    <div class="bar-wrapper">
                        <div class="bar bar-pendiente" style="height: ${hPendiente}%;">
                            <span class="value">${reporte.tareasPendientes}</span>
                        </div>
                        <span class="bar-label">Pendientes (A tiempo)</span>
                    </div>
                    
                    <div class="bar-wrapper">
                        <div class="bar bar-atrasada" style="height: ${hAtrasada}%;">
                            <span class="value">${reporte.tareasAtrasadas}</span>
                        </div>
                        <span class="bar-label">Atrasadas</span>
                    </div>

                    <div class="bar-wrapper">
                        <div class="bar bar-completada" style="height: ${hCompletada}%;">
                            <span class="value">${reporte.tareasCompletadas}</span>
                        </div>
                        <span class="bar-label">Completadas</span>
                    </div>
                </div>
            </div>
        `;

        // --- HTML DE LAS TARJETAS ---
        const statsHtml = `
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
                    <h4>Atrasadas</h4>
                    <p class="report-value danger">${reporte.tareasAtrasadas}</p>
                </div>
                <div class="report-card full-width">
                    <h4>Progreso General</h4>
                    <div class="progress-bar-container large">
                        <label>Avance (Completadas): ${reporte.porcentageCompletadas.toFixed(0)}%</label>
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

        // --- COMBINAR AMBOS ---
        reporteView.innerHTML = statsHtml + chartHtml;
        
        document.getElementById('edit-report-obs-btn').addEventListener('click', () => {
             alert('Funcionalidad de "Registrar Observaciones" no implementada en este script.');
        });
    }


    // --- 7. MANEJO DE EVENTOS (PESTAÑAS Y MODALES) ---

    // (Navegación de pestañas y Modal Info Proyecto sin cambios)
    document.querySelector('.tab-navigation').addEventListener('click', (e) => {
        if (e.target.matches('.tab-btn')) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
            const tabId = e.target.dataset.tab;
            e.target.classList.add('active');
            document.getElementById(`${tabId}-view`).classList.remove('hidden');
        }
    });

    document.getElementById('save-info-btn').addEventListener('click', async () => {
        const objetivo = document.getElementById('info-objetivo').value;
        const observaciones = document.getElementById('info-observaciones').value;

        try {
            await fetchWithAuth(`${API_BASE_URL}/planes/${idSolicitud}/${idPlan}`, {
                method: 'PUT',
                body: JSON.stringify({
                    objetivo: objetivo,
                    observaciones: observaciones 
                })
            });
            
            currentPlan.motivoAsesoria = objetivo;
            currentPlan.observaciones = observaciones;
            renderInfoTab(); 
            infoModal.classList.add('hidden');
            
        } catch (error) {
            console.error("Error al guardar observaciones:", error);
            alert("Error al guardar. Verifique la consola.");
        }
    });
    document.getElementById('cancel-info-btn').addEventListener('click', () => infoModal.classList.add('hidden'));


    // --- ★ CORRECCIÓN: Lógica Modal Actividad (Crear y Editar) ---
    document.getElementById('save-activity-btn').addEventListener('click', async () => {
        const nombreTarea = document.getElementById('activity-name').value;
        const fechaVencimiento = document.getElementById('activity-end').value;

        if (!nombreTarea || !fechaVencimiento) {
            alert("El nombre y la fecha de fin son obligatorios.");
            return;
        }

        const idUsuarioCliente = currentPlan.idUsuario; 
        if (!idUsuarioCliente) {
            alert("Error: No se pudo encontrar el ID del cliente en el plan actual.");
            return;
        }

        const mode = activityModal.dataset.mode;
        const editingId = activityModal.dataset.editingId;

        let url = `${API_BASE_URL}/tarea`;
        let method = 'POST';
        let originalTask = null;

        // Preparar payload
        const tareaPayload = {
            idPlan: idPlan,
            nombreTarea: nombreTarea,
            fechaVencimiento: fechaVencimiento,
            fechaInicio: new Date().toISOString().split('T')[0], 
            idEstado: 1, // Siempre se (re)establece a Pendiente al crear/editar
            idUsuario: idUsuarioCliente
        };

        if (mode === 'edit' && editingId) {
            url = `${API_BASE_URL}/tarea/${editingId}`;
            method = 'PUT';
            tareaPayload.idTarea = parseInt(editingId);
            originalTask = currentActivities.find(t => t.idTarea == editingId);
            
            if (originalTask) {
                tareaPayload.fechaInicio = originalTask.fechaInicio;
                tareaPayload.idUsuario = originalTask.idUsuario; // Asegurar que el idUsuario no se pierda
                
                // Si la tarea ya estaba completada (2), y el agrónomo la edita, 
                // la regresamos a Pendiente (1).
                // Si estaba pendiente (1), se queda en (1).
                tareaPayload.idEstado = 1; 
            }
        } 

        try {
            await fetchWithAuth(url, {
                method: method,
                headers: {
                    'confirmado': 'true' // Requerido por TareaController (para POST)
                },
                body: JSON.stringify(tareaPayload)
            });

            activityModal.classList.add('hidden');
            loadActivities(); // Recargar la lista de actividades

        } catch (error) {
            console.error(`Error al ${mode === 'edit' ? 'actualizar' : 'guardar'} la actividad:`, error);
            alert(`Error al ${mode === 'edit' ? 'actualizar' : 'guardar'}. Verifique la consola.`);
        }
    });
    document.getElementById('cancel-activity-btn').addEventListener('click', () => activityModal.classList.add('hidden'));

    // --- (Lógica de botones Eliminar/Editar sin cambios) ---
    actividadesView.addEventListener('click', async (e) => {
        if (e.target.matches('.btn-delete-task')) {
            const taskId = e.target.dataset.taskId;
            
            if (confirm("¿Estás seguro de que quieres eliminar esta tarea? (Se eliminarán también las evidencias asociadas)")) {
                try {
                    await fetchWithAuth(`${API_BASE_URL}/tarea/${taskId}`, {
                        method: 'DELETE'
                    });
                    loadActivities(); 
                } catch (error) {
                    console.error("Error al eliminar tarea:", error);
                    alert("Error al eliminar la tarea.");
                }
            }
        }
        
        if (e.target.matches('.btn-edit-task')) {
             const button = e.target;
             try {
                const taskJson = button.dataset.taskJson.replace(/&apos;/g, '"');
                const task = JSON.parse(taskJson);

                document.getElementById('activity-modal-title').textContent = "Editar actividad";
                document.getElementById('activity-name').value = task.nombreTarea;
                document.getElementById('activity-end').value = task.fechaVencimiento;
                
                activityModal.dataset.mode = 'edit';
                activityModal.dataset.editingId = task.idTarea;
                activityModal.classList.remove('hidden');

             } catch (err) {
                console.error("Error al parsear JSON de la tarea:", err);
                alert("No se pudo cargar la información de la tarea para editar.");
             }
        }
    });


    // --- 8. EJECUCIÓN INICIAL ---
    await loadProfileAndGreeting();
    await loadProjectData(); 

});