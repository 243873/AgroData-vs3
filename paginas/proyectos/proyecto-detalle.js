// paginas/proyectos/proyecto-detalle.js
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

    const successModal = document.getElementById('successModal');
    const successMessage = document.getElementById('successMessage');

    let currentPlan = null;
    let currentSolicitud = null;
    let currentPlanActivities = [];
    let currentPestActivities = [];
    let taskToDeleteId = null;
    let reportIdToLink = null; // <-- Variable para guardar el ID del reporte a vincular

    const estadoMap = { 1: 'Pendiente', 2: 'Completada' };
    const HOY = new Date(); 
    HOY.setHours(0, 0, 0, 0); 

    function showSuccess(message) {
        if (successModal && successMessage) {
            successMessage.textContent = message;
            successModal.classList.remove('hidden');
            setTimeout(() => successModal.classList.add('hidden'), 2000);
        } else {
            alert(message);
        }
    }

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
            console.error("Fatal error loading project data:", error);
            projectTitle.textContent = "Error al cargar proyecto";
            infoView.innerHTML = `<p class="error-message">No se pudieron cargar los datos. ${error.message}</p>`;
        }
    }

    // --- 6. RENDERIZADO DE PESTAÑAS ---
    
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

    async function loadActivities() {
        try {
            const allTasks = await fetchWithAuth(`${API_BASE_URL}/tarea`);
            const tasksForThisPlan = allTasks.filter(task => task.idPlan === idPlan);

            currentPlanActivities = tasksForThisPlan.filter(t => !t.nombreTarea.toLowerCase().includes('plaga'));
            currentPestActivities = tasksForThisPlan.filter(t => t.nombreTarea.toLowerCase().includes('plaga'));
            
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

        if (currentPlanActivities.length === 0) {
            activitiesHtml += '<p>No hay actividades generales asignadas a este plan.</p>';
        } else {
            activitiesHtml += currentPlanActivities.map(task => renderTaskItem(task)).join('');
        }
        
        activitiesHtml += `
            <div class="container-header" style="margin-top: 30px;">
                <h4>Actividades de Reporte de Plaga</h4>
                </div>
        `;
        
        if (currentPestActivities.length === 0) {
            activitiesHtml += '<p>No hay actividades de plaga asignadas a este plan.</p>';
        } else {
            activitiesHtml += currentPestActivities.map(task => renderTaskItem(task)).join('');
        }

        activitiesHtml += `
            <div class="container-header" style="margin-top: 30px;">
                <h4>Reportes de Plaga Recibidos</h4>
            </div>
            <div id="plagas-list">
                ${currentPlan.reportePlagas.length === 0 ? '<p>No hay reportes de plaga para este plan.</p>' : 
                    currentPlan.reportePlagas.map(plaga => `
                        <div class="plaga-item">
                            <div class="plaga-info">
                                <p><strong>ID ${plaga.idReportePlaga}:</strong> ${plaga.tipoPlaga}</p>
                                <p><strong>Descripción:</strong> ${plaga.descripcion}</p>
                                <p><strong>Fecha:</strong> ${new Date(plaga.fechaReporte).toLocaleDateString()}</p>
                            </div>
                            <div class="plaga-actions">
                                <button class="btn btn-primary btn-sm btn-create-task-from-report" data-report-id="${plaga.idReportePlaga}">Crear Tarea</button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;

        actividadesView.innerHTML = activitiesHtml;

        document.getElementById('add-activity-btn').addEventListener('click', () => {
            document.getElementById('activity-modal-title').textContent = "Agregar nueva actividad";
            document.getElementById('activity-form').reset();
            reportIdToLink = null; 
            activityModal.dataset.mode = 'add';
            activityModal.dataset.editingId = ''; 
            activityModal.classList.remove('hidden');
        });
    }

    function renderTaskItem(task) {
        const taskJson = JSON.stringify(task).replace(/'/g, "&apos;");
        
        let estadoNombre = estadoMap[task.idEstado] || 'Desconocido';
        let estadoClass = `status-${estadoNombre.toLowerCase().replace(/[\s()]/g, '-')}`;

        const fechaVencimiento = new Date(task.fechaVencimiento + 'T00:00:00');
        const isAtrasada = task.idEstado === 1 && fechaVencimiento < HOY;

        if (isAtrasada) {
            estadoNombre = 'Atrasada';
            estadoClass = 'status-atrasada';
        }
        
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
    `;
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

    // --- ★ ESTA ES LA FUNCIÓN COMPLETA Y CORREGIDA ★ ---
    function renderReportTab(reporte) {
        if (!reporte) {
            reporteView.innerHTML = '<p>No hay datos para generar un reporte.</p>';
            return;
        }
        
        const total = reporte.totalTareas;
        const totalPendientes = reporte.tareasPendientes + reporte.tareasAtrasadas;
        let hPendiente = 0, hAtrasada = 0, hCompletada = 0;
        
        if (total > 0) {
            hPendiente = (reporte.tareasPendientes / total) * 100;
            hAtrasada = (reporte.tareasAtrasadas / total) * 100;
            hCompletada = (reporte.tareasCompletadas / total) * 100;
        }

        // --- CÓDIGO DE ESTADÍSTICAS (RESTABLECIDO) ---
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

        // --- CÓDIGO DE GRÁFICA (RESTABLECIDO) ---
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

        reporteView.innerHTML = statsHtml + chartHtml;
        
        // --- ★ CORRECCIÓN PARA EL ERROR DE CONSOLA ★ ---
        // Se comprueba si el botón existe ANTES de añadir el listener
        const obsBtn = document.getElementById('edit-report-obs-btn');
        if (obsBtn) {
            obsBtn.addEventListener('click', () => {
                 alert('Funcionalidad de "Registrar Observaciones" no implementada en este script.');
            });
        } else {
            // Este mensaje aparecerá si la caché del navegador sigue corrupta
            console.warn("El botón 'edit-report-obs-btn' no se encontró en el DOM. La caché del navegador puede estar corrupta.");
        }
    }


    // --- 7. MANEJO DE EVENTOS (PESTAÑAS Y MODALES) ---
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
                body: JSON.stringify({ objetivo: objetivo, observaciones: observaciones })
            });
            currentPlan.motivoAsesoria = objetivo;
            currentPlan.observaciones = observaciones;
            renderInfoTab(); 
            infoModal.classList.add('hidden');
            showSuccess('Información actualizada');
        } catch (error) {
            console.error("Error al guardar observaciones:", error);
            alert("Error al guardar. Verifique la consola.");
        }
    });
    document.getElementById('cancel-info-btn').addEventListener('click', () => infoModal.classList.add('hidden'));

    document.getElementById('save-activity-btn').addEventListener('click', async () => {
        const nombreTarea = document.getElementById('activity-name').value;
        const fechaVencimiento = document.getElementById('activity-end').value;
        const idReportePlaga = reportIdToLink || 0; 

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

        const tareaPayload = {
            idPlan: idPlan,
            nombreTarea: nombreTarea,
            fechaVencimiento: fechaVencimiento,
            fechaInicio: new Date().toISOString().split('T')[0], 
            idEstado: 1, 
            idUsuario: idUsuarioCliente,
            idReportePlaga: idReportePlaga 
        };

        if (mode === 'edit' && editingId) {
            url = `${API_BASE_URL}/tarea/${editingId}`;
            method = 'PUT';
            tareaPayload.idTarea = parseInt(editingId);
            originalTask = [...currentPlanActivities, ...currentPestActivities].find(t => t.idTarea == editingId);
            
            if (originalTask) {
                tareaPayload.fechaInicio = originalTask.fechaInicio;
                tareaPayload.idUsuario = originalTask.idUsuario; 
                tareaPayload.idEstado = 1;
                tareaPayload.idReportePlaga = 0;
            }
        } 

        try {
            await fetchWithAuth(url, {
                method: method,
                headers: { 'confirmado': 'true' },
                body: JSON.stringify(tareaPayload)
            });

            activityModal.classList.add('hidden');
            loadActivities(); 
            showSuccess(mode === 'edit' ? 'Actividad actualizada' : 'Actividad agregada');

        } catch (error) {
            console.error(`Error al ${mode === 'edit' ? 'actualizar' : 'guardar'} la actividad:`, error);
            alert(`Error al ${mode === 'edit' ? 'actualizar' : 'guardar'}. Verifique la consola.`);
        } finally {
            reportIdToLink = null; 
        }
    });
    
    document.getElementById('cancel-activity-btn').addEventListener('click', () => {
        reportIdToLink = null; 
        activityModal.classList.add('hidden');
    });

    actividadesView.addEventListener('click', async (e) => {
        if (e.target.matches('.btn-delete-task')) {
            taskToDeleteId = e.target.dataset.taskId;
            deleteActivityModal.classList.remove('hidden');
        }
        
        if (e.target.matches('.btn-edit-task')) {
             const button = e.target;
             try {
                const taskJson = button.dataset.taskJson.replace(/&apos;/g, '"');
                const task = JSON.parse(taskJson);

                document.getElementById('activity-modal-title').textContent = "Editar actividad";
                document.getElementById('activity-name').value = task.nombreTarea;
                document.getElementById('activity-end').value = task.fechaVencimiento;
                
                reportIdToLink = null; 

                activityModal.dataset.mode = 'edit';
                activityModal.dataset.editingId = task.idTarea;
                activityModal.classList.remove('hidden');

             } catch (err) {
                console.error("Error al parsear JSON de la tarea:", err);
                alert("No se pudo cargar la información de la tarea para editar.");
             }
        }

        const createBtn = e.target.closest('.btn-create-task-from-report');
        if (createBtn) {
            reportIdToLink = parseInt(createBtn.dataset.reportId); 
            const plaga = currentPlan.reportePlagas.find(p => p.idReportePlaga === reportIdToLink);
            
            document.getElementById('activity-modal-title').textContent = "Crear Tarea para Reporte de Plaga";
            document.getElementById('activity-form').reset();
            
            if (plaga) {
                document.getElementById('activity-name').value = `Revisar reporte de plaga: ${plaga.tipoPlaga}`;
            } else {
                document.getElementById('activity-name').value = 'Revisar reporte de plaga: ';
            }

            activityModal.dataset.mode = 'add';
            activityModal.dataset.editingId = '';
            activityModal.classList.remove('hidden');
        }
    });

    document.getElementById('cancel-delete-btn').addEventListener('click', () => {
        deleteActivityModal.classList.add('hidden');
        taskToDeleteId = null;
    });

    document.getElementById('accept-delete-btn').addEventListener('click', async () => {
        if (!taskToDeleteId) return;
        try {
            await fetchWithAuth(`${API_BASE_URL}/tarea/${taskToDeleteId}`, {
                method: 'DELETE'
            });
            loadActivities(); 
            showSuccess('Tarea eliminada');
        } catch (error) {
            console.error("Error al eliminar tarea:", error);
            alert("Error al eliminar la tarea.");
        } finally {
            deleteActivityModal.classList.add('hidden');
            taskToDeleteId = null;
        }
    });


    // --- 8. EJECUCIÓN INICIAL ---
    await loadProfileAndGreeting();
    await loadProjectData(); 

});