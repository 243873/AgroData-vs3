// paginas/proyectos/proyecto-detalle.js
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. CONFIGURACIÓN INICIAL ---
    const API_BASE_URL = 'http://localhost:7000';
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual'));

    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        console.error("Acceso denegado o sesión inválida.");
        localStorage.clear();
        window.location.href = '../../index.html';
        return;
    }
    
    const authToken = authInfo.token;
    const urlParams = new URLSearchParams(window.location.search);
    const idPlan = parseInt(urlParams.get('idPlan'));
    const idSolicitud = parseInt(urlParams.get('idSolicitud'));

    if (!idPlan || !idSolicitud) {
        document.getElementById('project-container').innerHTML = '<h2>Error: Faltan parámetros en la URL.</h2>';
        return;
    }

    // --- ELEMENTOS DOM ---
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
    
    const evidenceModal = document.getElementById('evidence-modal');
    const evidenceImageFull = document.getElementById('evidence-image-full');
    const evidenceDescText = document.getElementById('evidence-desc-text');
    const closeEvidenceBtn = document.getElementById('close-evidence-btn');

    const btnCompleteProject = document.getElementById('btn-complete-project');

    let currentPlan = null;
    let currentSolicitud = null;
    let currentPlanActivities = [];
    let currentPestActivities = [];
    let projectEvidenceList = []; 
    let taskToDeleteId = null;
    let reportIdToLink = null; 

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

    function getTodayString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async function fetchWithAuth(url, options = {}) {
        const headers = { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json', 
            ...(options.headers || {}) 
        };
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                window.location.href = '../../index.html';
            }
            const errorText = await response.text();
            throw new Error(`Error de red: ${response.status} - ${errorText}`);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) return response.json();
        return response.text(); 
    }

    async function loadProfileAndGreeting() {
        try {
            const user = await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });
            if (welcomeMessage) welcomeMessage.textContent = `Bienvenido, ${user.nombre}`;
        } catch (error) {
            console.error('Error saludo:', error);
        }
    }

    async function loadProjectData() {
        try {
            const allPlans = await fetchWithAuth(`${API_BASE_URL}/obtenerPlanCultivos`);
            currentPlan = allPlans.find(p => p.idPlan === idPlan);
            
            if (!currentPlan) throw new Error("Plan no encontrado.");

            currentSolicitud = await fetchWithAuth(`${API_BASE_URL}/solicitudasesoria/${idSolicitud}`);

            try {
                projectEvidenceList = await fetchWithAuth(`${API_BASE_URL}/registroactividades/`);
            } catch (e) {
                projectEvidenceList = [];
            }

            projectTitle.textContent = `Detalle del Plan: ${currentPlan.motivoAsesoria.substring(0, 40)}...`;
            
            if (btnCompleteProject) {
                if (currentPlan.idEstado === 5) {
                    btnCompleteProject.textContent = "Reactivar Proyecto";
                    btnCompleteProject.classList.remove('btn-primary');
                    btnCompleteProject.classList.add('btn-secondary');
                } else {
                    btnCompleteProject.textContent = "Finalizar Proyecto";
                    btnCompleteProject.classList.add('btn-primary');
                    btnCompleteProject.classList.remove('btn-secondary');
                }
                btnCompleteProject.classList.remove('hidden');
            }

            renderInfoTab();
            loadActivities();
            loadReport();

        } catch (error) {
            console.error("Error fatal:", error);
            projectTitle.textContent = "Error al cargar";
            infoView.innerHTML = `<p class="error-message">${error.message}</p>`;
        }
    }
    
    function renderInfoTab() {
        if (!currentPlan || !currentSolicitud) return;
        const cultivosHtml = currentPlan.cultivoPorSolicitud.map(c => `<span class="tag">${c.nombreCultivo}</span>`).join('');
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
                    <p><strong>Objetivo:</strong> ${currentPlan.motivoAsesoria}</p>
                    <p><strong>Observaciones:</strong> ${currentPlan.observaciones || 'Sin observaciones'}</p>
                    <p><strong>Superficie:</strong> ${currentPlan.superficieTotal} hectáreas</p>
                    <p><strong>Cultivos:</strong> ${cultivosHtml}</p>
                    <button id="edit-info-btn" class="btn btn-secondary">Editar Observaciones</button>
                </div>
                <div class="info-card full-width">
                    <h4>Información Original</h4>
                    <div class="solicitud-grid">
                        <p><strong>Riego:</strong> ${solicitud.nombreRiego || 'N/A'}</p>
                        <p><strong>Maquinaria:</strong> ${solicitud.usoMaquinaria ? `Sí (${solicitud.nombreMaquinaria})` : 'No'}</p>
                        <p><strong>Plaga:</strong> ${solicitud.tienePlaga ? `Sí (${solicitud.descripcionPlaga})` : 'No'}</p>
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

        if (currentPlanActivities.length === 0) activitiesHtml += '<p>No hay actividades generales.</p>';
        else activitiesHtml += currentPlanActivities.map(task => renderTaskItem(task)).join('');
        
        activitiesHtml += `<div class="container-header" style="margin-top: 30px;"><h4>Actividades de Reporte de Plaga</h4></div>`;
        
        if (currentPestActivities.length === 0) activitiesHtml += '<p>No hay actividades de plaga.</p>';
        else activitiesHtml += currentPestActivities.map(task => renderTaskItem(task)).join('');

        activitiesHtml += `
            <div class="container-header" style="margin-top: 30px;">
                <h4>Reportes de Plaga Recibidos</h4>
            </div>
            <div id="plagas-list">
                ${currentPlan.reportePlagas.length === 0 ? '<p>No hay reportes de plaga.</p>' : 
                    currentPlan.reportePlagas.map(plaga => `
                        <div class="plaga-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background-color: white; border: 1px solid #E9ECEF; border-radius: 8px; margin-bottom: 10px;">
                            <div class="plaga-info">
                                <p style="margin:0; font-size:16px;"><strong>ID ${plaga.idReportePlaga}:</strong> ${plaga.tipoPlaga}</p>
                                <p style="margin:5px 0 0; color:#555; font-size:14px;">${plaga.descripcion}</p>
                                <p style="margin:5px 0 0; color:#888; font-size:12px;">${new Date(plaga.fechaReporte).toLocaleDateString()}</p>
                            </div>
                            <div class="plaga-actions">
                                <button class="btn btn-primary btn-create-task-from-report" data-report-id="${plaga.idReportePlaga}">Crear Tarea</button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;

        actividadesView.innerHTML = activitiesHtml;

        document.getElementById('add-activity-btn').addEventListener('click', () => {
            const today = getTodayString();
            document.getElementById('activity-modal-title').textContent = "Agregar nueva actividad";
            document.getElementById('activity-form').reset();
            document.getElementById('activity-start').min = today;
            document.getElementById('activity-end').min = today;
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
        const evidencia = projectEvidenceList.find(e => e.idTarea === task.idTarea);
        let evidenceLink = '';

        if (evidencia && evidencia.imagen) {
            evidenceLink = `<a href="#" class="view-evidence-link" data-img="${evidencia.imagen}" data-desc="${evidencia.descripcion || ''}" style="display:block; font-size:12px; margin-top:5px; color:#1C6E3E; text-decoration:underline;">Ver imagen</a>`;
        }
        
        return `
        <div class="activity-item">
            <div class="activity-info">
                <strong>${task.nombreTarea}</strong>
                <p>Inicia: ${task.fechaInicio || 'N/A'}</p>
                <p>Estado: <span class="${estadoClass}">${estadoNombre}</span></p>
                ${evidenceLink}
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
            reporteView.innerHTML = `<p class="error-message">No se pudo cargar el reporte.</p>`;
        }
    }

    function renderReportTab(reporte) {
        if (!reporte) {
            reporteView.innerHTML = '<p>No hay datos para generar un reporte.</p>';
            return;
        }
        const total = reporte.totalTareas;
        let hPendiente = 0, hAtrasada = 0, hCompletada = 0;
        if (total > 0) {
            hPendiente = (reporte.tareasPendientes / total) * 100;
            hAtrasada = (reporte.tareasAtrasadas / total) * 100;
            hCompletada = (reporte.tareasCompletadas / total) * 100;
        }

        const statsHtml = `
            <div class="report-grid">
                <div class="report-card"><h4>Tareas Totales</h4><p class="report-value">${reporte.totalTareas}</p></div>
                <div class="report-card"><h4>Completadas</h4><p class="report-value success">${reporte.tareasCompletadas}</p></div>
                <div class="report-card"><h4>Pendientes</h4><p class="report-value warning">${reporte.tareasPendientes}</p></div>
                <div class="report-card"><h4>Atrasadas</h4><p class="report-value danger">${reporte.tareasAtrasadas}</p></div>
                <div class="report-card full-width">
                    <h4>Progreso General</h4>
                    <div class="progress-bar-container large">
                        <label>Avance: ${reporte.porcentageCompletadas.toFixed(0)}%</label>
                        <div class="progress-bar"><div class="progress-bar-fill" style="width: ${reporte.porcentageCompletadas}%;"></div></div>
                    </div>
                </div>
                 <div class="report-card full-width">
                    <h4>Observaciones</h4>
                    <p>${reporte.observaciones || 'Sin observaciones.'}</p>
                    <button id="edit-report-obs-btn" class="btn btn-secondary">Registrar/Editar Observaciones</button>
                </div>
            </div>`;

        const chartHtml = `
            <div class="chart-section">
                <h4>Distribución de Tareas</h4>
                <div class="chart-container">
                    <div class="bar-wrapper"><div class="bar bar-pendiente" style="height: ${hPendiente}%;"><span class="value">${reporte.tareasPendientes}</span></div><span class="bar-label">Pendientes</span></div>
                    <div class="bar-wrapper"><div class="bar bar-atrasada" style="height: ${hAtrasada}%;"><span class="value">${reporte.tareasAtrasadas}</span></div><span class="bar-label">Atrasadas</span></div>
                    <div class="bar-wrapper"><div class="bar bar-completada" style="height: ${hCompletada}%;"><span class="value">${reporte.tareasCompletadas}</span></div><span class="bar-label">Completadas</span></div>
                </div>
            </div>`;

        reporteView.innerHTML = statsHtml + chartHtml;
        
        const obsBtn = document.getElementById('edit-report-obs-btn');
        if (obsBtn) {
            obsBtn.addEventListener('click', () => alert('Funcionalidad no implementada en este script.'));
        }
    }

    // --- EVENTOS ---
    document.querySelector('.tab-navigation').addEventListener('click', (e) => {
        if (e.target.matches('.tab-btn')) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
            e.target.classList.add('active');
            document.getElementById(`${e.target.dataset.tab}-view`).classList.remove('hidden');
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
            alert("Error al guardar. Verifique la consola.");
        }
    });
    document.getElementById('cancel-info-btn').addEventListener('click', () => infoModal.classList.add('hidden'));

    document.getElementById('save-activity-btn').addEventListener('click', async () => {
        const nombreTarea = document.getElementById('activity-name').value;
        const fechaInicio = document.getElementById('activity-start').value;
        const fechaVencimiento = document.getElementById('activity-end').value;
        const idReportePlaga = reportIdToLink || 0; 
        const today = getTodayString();

        if (!nombreTarea || !fechaInicio || !fechaVencimiento) {
            alert("Todos los campos son obligatorios.");
            return;
        }
        if (fechaInicio < today || fechaVencimiento < today) {
             alert("Las fechas no pueden ser anteriores a hoy.");
             return;
        }
        if (fechaVencimiento < fechaInicio) {
            alert("Vencimiento debe ser posterior al inicio.");
            return;
        }

        const idUsuarioCliente = currentPlan.idUsuario; 
        const mode = activityModal.dataset.mode;
        const editingId = activityModal.dataset.editingId;
        let url = `${API_BASE_URL}/tarea`;
        let method = 'POST';

        const tareaPayload = {
            idPlan: idPlan,
            nombreTarea: nombreTarea,
            fechaInicio: fechaInicio,
            fechaVencimiento: fechaVencimiento,
            idEstado: 1, 
            idUsuario: idUsuarioCliente,
            idReportePlaga: idReportePlaga 
        };

        if (mode === 'edit' && editingId) {
            url = `${API_BASE_URL}/tarea/${editingId}`;
            method = 'PUT';
            tareaPayload.idTarea = parseInt(editingId);
            const originalTask = [...currentPlanActivities, ...currentPestActivities].find(t => t.idTarea == editingId);
            if (originalTask) {
                tareaPayload.idEstado = originalTask.idEstado;
                tareaPayload.idReportePlaga = originalTask.idReportePlaga || 0;
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
            showSuccess(mode === 'edit' ? 'Actualizado' : 'Agregado');
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            reportIdToLink = null; 
        }
    });
    
    document.getElementById('cancel-activity-btn').addEventListener('click', () => {
        reportIdToLink = null; 
        activityModal.classList.add('hidden');
    });

    // ★ CORRECCIÓN: LISTENER DE FINALIZAR PROYECTO (SIN .ok) ★
    if (btnCompleteProject) {
        btnCompleteProject.addEventListener('click', async () => {
            const nuevoEstado = currentPlan.idEstado === 5 ? 2 : 5;
            const accion = nuevoEstado === 5 ? "finalizar" : "reactivar";

            if (confirm(`¿Estás seguro de que deseas ${accion} este proyecto?`)) {
                try {
                    // Hacemos fetch
                    const response = await fetchWithAuth(`${API_BASE_URL}/planes/${idPlan}/estado/${nuevoEstado}`, {
                        method: 'PATCH'
                    });
                    // Si fetchWithAuth no lanzó error, asumimos éxito
                    alert(`Proyecto ${nuevoEstado === 5 ? 'finalizado' : 'reactivado'} con éxito.`);
                    location.reload(); 
                } catch (error) {
                    // Si hubo error, fetchWithAuth ya lo lanzó
                    console.error(error);
                    alert(`Error al actualizar estado: ${error.message}`);
                }
            }
        });
    }
    // ★ FIN CORRECCIÓN ★

    actividadesView.addEventListener('click', async (e) => {
        const today = getTodayString();

        if (e.target.matches('.view-evidence-link')) {
            e.preventDefault();
            evidenceImageFull.src = e.target.dataset.img;
            evidenceDescText.textContent = e.target.dataset.desc;
            evidenceModal.classList.remove('hidden');
            return;
        }

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
                const startInput = document.getElementById('activity-start');
                const endInput = document.getElementById('activity-end');
                startInput.value = task.fechaInicio;
                endInput.value = task.fechaVencimiento;
                
                if (task.fechaInicio < today) startInput.min = task.fechaInicio;
                else startInput.min = today;
                endInput.min = today;

                reportIdToLink = null; 
                activityModal.dataset.mode = 'edit';
                activityModal.dataset.editingId = task.idTarea;
                activityModal.classList.remove('hidden');
             } catch (err) { alert("Error al cargar tarea."); }
        }

        const createBtn = e.target.closest('.btn-create-task-from-report');
        if (createBtn) {
            reportIdToLink = parseInt(createBtn.dataset.reportId); 
            const plaga = currentPlan.reportePlagas.find(p => p.idReportePlaga === reportIdToLink);
            document.getElementById('activity-modal-title').textContent = "Crear Tarea para Plaga";
            document.getElementById('activity-form').reset();
            document.getElementById('activity-start').min = today;
            document.getElementById('activity-end').min = today;
            if (plaga) document.getElementById('activity-name').value = `Revisar reporte: ${plaga.tipoPlaga}`;
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
            await fetchWithAuth(`${API_BASE_URL}/tarea/${taskToDeleteId}`, { method: 'DELETE' });
            loadActivities(); 
            showSuccess('Tarea eliminada');
        } catch (error) {
            alert("Error al eliminar.");
        } finally {
            deleteActivityModal.classList.add('hidden');
            taskToDeleteId = null;
        }
    });

    if (closeEvidenceBtn) closeEvidenceBtn.addEventListener('click', () => evidenceModal.classList.add('hidden'));

    await loadProfileAndGreeting();
    await loadProjectData(); 
});