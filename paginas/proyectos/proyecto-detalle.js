// paginas/proyectos/proyecto-detalle.js
document.addEventListener('DOMContentLoaded', async () => {

    const authInfo = JSON.parse(localStorage.getItem('usuarioActual'));

    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        console.error("Acceso denegado.");
        localStorage.clear();
        window.location.href = '../../index.html';
        return;
    }
    
    const authToken = authInfo.token;
    const urlParams = new URLSearchParams(window.location.search);
    const idPlan = parseInt(urlParams.get('idPlan'));
    const idSolicitud = parseInt(urlParams.get('idSolicitud'));

    if (!idPlan || !idSolicitud) {
        document.getElementById('project-container').innerHTML = `<h2>${t('error.missingParams')}</h2>`;
        return;
    }

    // --- ELEMENTOS DOM ---
    const projectTitle = document.getElementById('project-title');
    const infoView = document.getElementById('info-view');
    const actividadesView = document.getElementById('actividades-view');
    const reporteView = document.getElementById('reporte-view');

    // Modales
    const infoModal = document.getElementById('info-modal');
    const activityModal = document.getElementById('activity-modal');
    const deleteActivityModal = document.getElementById('delete-activity-modal'); 
    const successModal = document.getElementById('successModal');
    const successMessage = document.getElementById('successMessage');
    
    // Modal de Evidencia
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

    // Inyectar librería PDF si no existe
    if (!window.html2pdf) {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        document.head.appendChild(script);
    }

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
            throw new Error(`Error API: ${response.status} - ${errorText}`);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) return response.json();
        return response.text(); 
    }

    async function loadProfileAndGreeting() {
        try {
            await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });
        } catch (error) { console.error('Error saludo:', error); }
    }

    async function loadProjectData() {
        try {
            const allPlans = await fetchWithAuth(`${API_BASE_URL}/obtenerPlanCultivos`);
            currentPlan = allPlans.find(p => p.idPlan === idPlan);
            if (!currentPlan) throw new Error("Plan no encontrado.");

            currentSolicitud = await fetchWithAuth(`${API_BASE_URL}/solicitudasesoria/${idSolicitud}`);

            try {
                projectEvidenceList = await fetchWithAuth(`${API_BASE_URL}/registroactividades/`);
            } catch (e) { projectEvidenceList = []; }

            projectTitle.textContent = `Plan de Cultivo: ${currentPlan.cultivoPorSolicitud.map(c=>c.nombreCultivo).join(', ')}`;
            
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
                <div class="info-card"><h4>Detalles del Cliente</h4><p><strong>Nombre:</strong> ${currentPlan.nombre} ${currentPlan.apellidoPaterno}</p><p><strong>Ubicación:</strong> ${currentPlan.direccionTerreno}</p></div>
                <div class="info-card"><h4>Datos de la Asesoría</h4><p><strong>Objetivo:</strong> ${currentPlan.motivoAsesoria}</p><p><strong>Observaciones Agrónomo:</strong> ${currentPlan.observaciones || 'Sin observaciones'}</p><p><strong>Superficie:</strong> ${currentPlan.superficieTotal} hectáreas</p><p><strong>Cultivos:</strong> ${cultivosHtml}</p><button id="edit-info-btn" class="btn btn-secondary">Editar Observaciones</button></div>
                <div class="info-card full-width"><h4>Información Original</h4><div class="solicitud-grid"><p><strong>Riego:</strong> ${solicitud.nombreRiego || 'N/A'}</p><p><strong>Maquinaria:</strong> ${solicitud.usoMaquinaria ? `Sí (${solicitud.nombreMaquinaria})` : 'No'}</p><p><strong>Plaga:</strong> ${solicitud.tienePlaga ? `Sí (${solicitud.descripcionPlaga})` : 'No'}</p></div></div>
            </div>`;
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
        } catch (error) { actividadesView.innerHTML = `<p class="error-message">Error al cargar actividades.</p>`; }
    }

    function renderActivitiesTab() {
        let html = `<div class="container-header"><h4>Actividades del Plan</h4><button id="add-activity-btn" class="btn btn-primary">Añadir Actividad</button></div>`;
        if (currentPlanActivities.length === 0) html += '<p>No hay actividades generales asignadas.</p>';
        else html += currentPlanActivities.map(task => renderTaskItem(task)).join('');
        
        html += `<div class="container-header" style="margin-top:30px;"><h4>Actividades de Reporte de Plaga</h4></div>`;
        if (currentPestActivities.length === 0) html += '<p>No hay actividades de plaga asignadas.</p>';
        else html += currentPestActivities.map(task => renderTaskItem(task)).join('');

        html += `<div class="container-header" style="margin-top:30px;"><h4>Reportes de Plaga Recibidos</h4></div><div id="plagas-list">`;
        if (currentPlan.reportePlagas.length === 0) html += '<p>No hay reportes.</p>';
        else {
            html += currentPlan.reportePlagas.map(p => `
                <div class="plaga-item" style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:white; border:1px solid #E9ECEF; border-radius:8px; margin-bottom:10px;">
                    <div class="plaga-info"><p style="margin:0; font-weight:600;">ID ${p.idReportePlaga}: ${p.tipoPlaga}</p><p style="margin:5px 0; font-size:14px; color:#555;">${p.descripcion}</p><p style="margin:0; font-size:12px; color:#888;">${new Date(p.fechaReporte).toLocaleDateString()}</p></div>
                    <div class="plaga-actions"><button class="btn btn-primary btn-create-task-from-report" data-report-id="${p.idReportePlaga}">Crear Tarea</button></div>
                </div>`).join('');
        }
        html += `</div>`;
        actividadesView.innerHTML = html;

        document.getElementById('add-activity-btn').addEventListener('click', () => {
            document.getElementById('activity-modal-title').textContent = "Agregar nueva actividad";
            document.getElementById('activity-form').reset();
            document.getElementById('activity-start').min = getTodayString();
            document.getElementById('activity-end').min = getTodayString();
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
        let link = evidencia && evidencia.imagen ? `<a href="#" class="view-evidence-link" data-img="${evidencia.imagen}" data-desc="${evidencia.descripcion||''}" style="display:block; font-size:12px; margin-top:5px; color:#1C6E3E; text-decoration:underline;">Ver imagen</a>` : '';
        
        return `<div class="activity-item"><div class="activity-info"><strong>${task.nombreTarea}</strong><p>Inicia: ${task.fechaInicio||'N/A'}</p><p>Estado: <span class="${estadoClass}">${estadoNombre}</span></p>${link}<p>Vence: ${task.fechaVencimiento}</p></div><div class="activity-actions"><button class="btn btn-secondary btn-edit-task" data-task-json='${taskJson}'>Editar</button><button class="btn btn-danger btn-delete-task" data-task-id="${task.idTarea}">Eliminar</button></div></div>`;
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
        if (!reporte) { reporteView.innerHTML = '<p>No hay datos.</p>'; return; }
        
        const total = reporte.totalTareas;
        // Calcular alturas de barras
        const hPlanificadas = total > 0 ? 100 : 0; 
        const hCumplidas = total > 0 ? (reporte.tareasCompletadas / total) * 100 : 0;
        const hAtrasadas = total > 0 ? (reporte.tareasAtrasadas / total) * 100 : 0;
        const hPendientes = total > 0 ? (reporte.tareasPendientes / total) * 100 : 0;

        let html = `
            <div id="pdf-content" style="padding: 20px; background: white;"> 
                <div style="text-align:center; margin-bottom:20px;">
                    <h3 style="color:#1C6E3E; margin:0;">Reporte de Desempeño - AgroData</h3>
                    <p style="color:#666; margin:5px 0;">Plan de Cultivo #${idPlan}</p>
                </div>

                <div class="report-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; text-align: center;">
                    <div class="report-card" style="background:#F8F9FA; padding:15px; border-radius:8px;"><h4>Planificadas</h4><p class="report-value" style="font-size:24px; font-weight:bold;">${total}</p></div>
                    <div class="report-card" style="background:#F8F9FA; padding:15px; border-radius:8px;"><h4>Cumplidas</h4><p class="report-value success" style="font-size:24px; font-weight:bold; color:#28A745;">${reporte.tareasCompletadas}</p></div>
                    <div class="report-card" style="background:#F8F9FA; padding:15px; border-radius:8px;"><h4>Atrasadas</h4><p class="report-value danger" style="font-size:24px; font-weight:bold; color:#DC3545;">${reporte.tareasAtrasadas}</p></div>
                    <div class="report-card" style="background:#F8F9FA; padding:15px; border-radius:8px;"><h4>Pendientes</h4><p class="report-value warning" style="font-size:24px; font-weight:bold; color:#FFC107;">${reporte.tareasPendientes}</p></div>
                </div>

                <div class="stats-summary" style="margin-bottom:30px; text-align:center; font-weight:600; color:#333; font-size:16px; border-top:1px solid #eee; border-bottom:1px solid #eee; padding:15px 0;">
                    Progreso General: ${reporte.porcentageCompletadas.toFixed(0)}% &nbsp;|&nbsp;
                    Evidencias recopiladas: ${projectEvidenceList.length}
                </div>

                <h4 style="margin-bottom: 20px;">Estadísticas actuales:</h4>
                <div class="chart-container" style="height: 300px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 30px; align-items: flex-end; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-bottom: 40px;">
                    <div class="bar-wrapper" style="text-align:center; height:100%; display:flex; flex-direction:column; justify-content:flex-end;">
                        <span style="margin-bottom:5px; font-weight:bold;">${total}</span>
                        <div class="bar" style="height: ${hPlanificadas}%; width: 100%; background-color: #1C6E3E; border-radius:5px 5px 0 0;"></div>
                        <span class="bar-label" style="margin-top:10px; font-size:12px; font-weight:600;">Planificadas</span>
                    </div>
                    <div class="bar-wrapper" style="text-align:center; height:100%; display:flex; flex-direction:column; justify-content:flex-end;">
                        <span style="margin-bottom:5px; font-weight:bold;">${reporte.tareasCompletadas}</span>
                        <div class="bar" style="height: ${hCumplidas}%; width: 100%; background-color: #6AA84F; border-radius:5px 5px 0 0;"></div>
                        <span class="bar-label" style="margin-top:10px; font-size:12px; font-weight:600;">Cumplidas</span>
                    </div>
                    <div class="bar-wrapper" style="text-align:center; height:100%; display:flex; flex-direction:column; justify-content:flex-end;">
                        <span style="margin-bottom:5px; font-weight:bold;">${reporte.tareasAtrasadas}</span>
                        <div class="bar" style="height: ${hAtrasadas}%; width: 100%; background-color: #DC3545; border-radius:5px 5px 0 0;"></div>
                        <span class="bar-label" style="margin-top:10px; font-size:12px; font-weight:600;">Atrasadas</span>
                    </div>
                    <div class="bar-wrapper" style="text-align:center; height:100%; display:flex; flex-direction:column; justify-content:flex-end;">
                        <span style="margin-bottom:5px; font-weight:bold;">${reporte.tareasPendientes}</span>
                        <div class="bar" style="height: ${hPendientes}%; width: 100%; background-color: #FFC107; border-radius:5px 5px 0 0;"></div>
                        <span class="bar-label" style="margin-top:10px; font-size:12px; font-weight:600;">Pendientes</span>
                    </div>
                </div>

                <h4 style="margin-top: 40px; margin-bottom: 20px;">Evidencias y Observaciones:</h4>
                <div class="evidence-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        `;

        const allTasks = [...currentPlanActivities, ...currentPestActivities];
        const tasksWithEvidence = allTasks.filter(task => projectEvidenceList.some(e => e.idTarea === task.idTarea));

        if (tasksWithEvidence.length === 0) {
            html += `<p style="grid-column: 1 / -1; text-align: center; color:#666;">No hay evidencias registradas aún.</p>`;
        } else {
            tasksWithEvidence.forEach(task => {
                const evidencia = projectEvidenceList.find(e => e.idTarea === task.idTarea);
                let duration = 1;
                if (task.fechaInicio && task.fechaCompletado) {
                     const start = new Date(task.fechaInicio);
                     const end = new Date(task.fechaCompletado);
                     duration = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1; 
                }

                html += `
                    <div class="evidence-card" style="background-color: #FDFBF7; border: 1px solid #E9ECEF; border-radius: 12px; padding: 20px; break-inside: avoid;">
                        <h5 style="margin-top: 0; color: #1C6E3E; font-size: 16px;">${task.nombreTarea}</h5>
                        <div style="width: 100%; height: 200px; background-color: #eee; border-radius: 8px; overflow: hidden; margin-bottom: 15px;">
                            <img src="${evidencia.imagen}" alt="Evidencia" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <p style="margin: 5px 0; font-size: 13px; color: #333;"><strong>Duración:</strong> ${duration} días</p>
                        <p style="margin: 5px 0; font-size: 13px; color: #333;"><strong>Observaciones:</strong></p>
                        <p style="margin: 0; font-size: 13px; color: #666; font-style: italic;">"${evidencia.descripcion || 'Sin comentarios.'}"</p>
                    </div>
                `;
            });
        }

        html += `</div>`; 

        // data-html2canvas-ignore se usa para que el botón no salga en el PDF
        html += `
                <h4 style="margin-top: 40px; margin-bottom: 10px; color:#1C6E3E;">Rendimiento Final:</h4>
                <textarea id="rendimiento-final-input" style="width: 100%; padding: 15px; border: 1px solid #CCC; border-radius: 8px; min-height: 100px; font-family: 'Montserrat', sans-serif; font-size:14px; resize: vertical; background-color: #FFF;" placeholder="Escriba el rendimiento final del cultivo...">${reporte.observaciones || ''}</textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 15px; margin-top: 30px; padding-bottom: 30px;">
                <button id="save-yield-btn" class="btn btn-secondary">Guardar Rendimiento</button>
                <button id="generate-pdf-btn" class="btn btn-primary" style="background-color: #14532d; color: white;">Generar reporte PDF</button>
            </div>
        `;

        reporteView.innerHTML = html;

        // --- EVENTO CORREGIDO: Guardar Rendimiento ---
        document.getElementById('save-yield-btn').addEventListener('click', async () => {
            const rendimiento = document.getElementById('rendimiento-final-input').value;
            try {
                const payload = {
                    idPlan: idPlan,
                    fechaGeneracion: new Date().toISOString().split('.')[0], 
                    observaciones: rendimiento,
                    // Los valores numéricos se ignoran en el backend al actualizar solo observaciones,
                    // pero se envían para cumplir con el modelo.
                    totalTareas: 0, tareasCompletadas: 0, tareasAceptadas: 0, tareasPendientes: 0, tareasAtrasadas: 0, porcentageCompletadas: 0 
                };

                // Usamos fetchWithAuth, que ya maneja el error si !response.ok
                await fetchWithAuth(`${API_BASE_URL}/registrarReporteDesempeno`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // Si llega aquí es éxito
                alert("Rendimiento final guardado correctamente.");

            } catch (e) {
                console.error(e);
                alert("Error al guardar: " + e.message);
            }
        });

        // --- EVENTO: Generar PDF ---
        document.getElementById('generate-pdf-btn').addEventListener('click', () => {
            const element = document.getElementById('pdf-content');
            const opt = {
                margin:       [15, 15, 15, 15], 
                filename:     `Reporte_Cultivo_${idPlan}_${new Date().toISOString().split('T')[0]}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, letterRendering: true }, 
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
            };

            if (window.html2pdf) {
                // Hack: Reemplazar textarea por div para correcta renderización
                const textarea = document.getElementById('rendimiento-final-input');
                const textVal = textarea.value;
                const p = document.createElement('p');
                p.style.cssText = "white-space: pre-wrap; font-family: 'Montserrat', sans-serif; font-size: 14px; background: #fff; border: 1px solid #ccc; padding: 15px; border-radius: 8px;";
                p.textContent = textVal;
                textarea.replaceWith(p);

                html2pdf().set(opt).from(element).save().then(() => {
                    p.replaceWith(textarea);
                    textarea.value = textVal;
                });
            } else {
                alert("La librería PDF se está cargando. Intente de nuevo.");
            }
        });
    }

    // --- EVENTOS GENERALES ---
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
                method: 'PUT', body: JSON.stringify({ objetivo, observaciones })
            });
            currentPlan.motivoAsesoria = objetivo;
            currentPlan.observaciones = observaciones;
            renderInfoTab(); 
            infoModal.classList.add('hidden');
            showSuccess('Información actualizada');
        } catch (error) { alert("Error al guardar."); }
    });
    document.getElementById('cancel-info-btn').addEventListener('click', () => infoModal.classList.add('hidden'));

    document.getElementById('save-activity-btn').addEventListener('click', async () => {
        const nombreTarea = document.getElementById('activity-name').value;
        const fechaInicio = document.getElementById('activity-start').value;
        const fechaVencimiento = document.getElementById('activity-end').value;
        const idReportePlaga = reportIdToLink || 0; 
        const today = getTodayString();

        if (!nombreTarea || !fechaInicio || !fechaVencimiento) { alert("Todos los campos obligatorios."); return; }
        if (fechaInicio < today || fechaVencimiento < today) { alert("Fechas no válidas."); return; }
        if (fechaVencimiento < fechaInicio) { alert("Vencimiento menor a inicio."); return; }

        const mode = activityModal.dataset.mode;
        const editingId = activityModal.dataset.editingId;
        let url = `${API_BASE_URL}/tarea`;
        let method = 'POST';

        const tareaPayload = {
            idPlan: idPlan, nombreTarea, fechaInicio, fechaVencimiento,
            idEstado: 1, idUsuario: currentPlan.idUsuario, idReportePlaga
        };

        if (mode === 'edit' && editingId) {
            url = `${API_BASE_URL}/tarea/${editingId}`;
            method = 'PUT';
            tareaPayload.idTarea = parseInt(editingId);
            const original = [...currentPlanActivities, ...currentPestActivities].find(t => t.idTarea == editingId);
            if (original) { 
                tareaPayload.idEstado = original.idEstado; 
                tareaPayload.idReportePlaga = original.idReportePlaga || 0;
            }
        } 

        try {
            await fetchWithAuth(url, { method, headers: { 'confirmado': 'true' }, body: JSON.stringify(tareaPayload) });
            activityModal.classList.add('hidden');
            loadActivities(); 
            showSuccess(mode === 'edit' ? 'Actualizado' : 'Agregado');
        } catch (error) { alert(`Error: ${error.message}`); }
        finally { reportIdToLink = null; }
    });
    
    document.getElementById('cancel-activity-btn').addEventListener('click', () => { reportIdToLink = null; activityModal.classList.add('hidden'); });

    if (btnCompleteProject) {
        btnCompleteProject.addEventListener('click', async () => {
            const nuevoEstado = currentPlan.idEstado === 5 ? 2 : 5;
            if (confirm(`¿Confirmar acción?`)) {
                try {
                    await fetchWithAuth(`${API_BASE_URL}/planes/${idPlan}/estado/${nuevoEstado}`, { method: 'PATCH' });
                    alert("Estado actualizado.");
                    location.reload();
                } catch (error) { alert(`Error: ${error.message}`); }
            }
        });
    }

    actividadesView.addEventListener('click', async (e) => {
        const today = getTodayString();
        if (e.target.matches('.view-evidence-link')) {
            e.preventDefault();
            evidenceImageFull.src = e.target.dataset.img;
            evidenceDescText.textContent = e.target.dataset.desc;
            evidenceModal.classList.remove('hidden');
        }
        if (e.target.matches('.btn-delete-task')) {
            taskToDeleteId = e.target.dataset.taskId;
            deleteActivityModal.classList.remove('hidden');
        }
        if (e.target.matches('.btn-edit-task')) {
             const t = JSON.parse(e.target.dataset.taskJson.replace(/&apos;/g, '"'));
             document.getElementById('activity-modal-title').textContent = "Editar actividad";
             document.getElementById('activity-name').value = t.nombreTarea;
             document.getElementById('activity-start').value = t.fechaInicio;
             document.getElementById('activity-end').value = t.fechaVencimiento;
             
             const start = document.getElementById('activity-start');
             start.min = (t.fechaInicio < today) ? t.fechaInicio : today;
             document.getElementById('activity-end').min = today;

             reportIdToLink = null; 
             activityModal.dataset.mode = 'edit';
             activityModal.dataset.editingId = t.idTarea;
             activityModal.classList.remove('hidden');
        }
        if (e.target.closest('.btn-create-task-from-report')) {
            const btn = e.target.closest('.btn-create-task-from-report');
            reportIdToLink = parseInt(btn.dataset.reportId); 
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

    document.getElementById('cancel-delete-btn').addEventListener('click', () => { deleteActivityModal.classList.add('hidden'); taskToDeleteId = null; });
    document.getElementById('accept-delete-btn').addEventListener('click', async () => {
        if (!taskToDeleteId) return;
        try {
            await fetchWithAuth(`${API_BASE_URL}/tarea/${taskToDeleteId}`, { method: 'DELETE' });
            loadActivities(); 
            showSuccess('Eliminado');
        } catch (error) { alert("Error al eliminar."); }
        finally { deleteActivityModal.classList.add('hidden'); taskToDeleteId = null; }
    });

    if (closeEvidenceBtn) closeEvidenceBtn.addEventListener('click', () => evidenceModal.classList.add('hidden'));

    await loadProfileAndGreeting();
    await loadProjectData(); 
});