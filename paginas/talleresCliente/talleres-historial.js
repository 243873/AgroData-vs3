document.addEventListener('DOMContentLoaded', async () => {
    const authString = localStorage.getItem('usuarioActual');
    const usuarioActual = authString ? JSON.parse(authString) : null;

    if (!usuarioActual || !usuarioActual.id || !usuarioActual.token) { 
        window.location.href = '/index.html'; 
        return; 
    }
    const authToken = usuarioActual.token;
    const userId = usuarioActual.id;
    
    let catalogoTalleres = [];
    let allRequests = []; 
    let userProfileData = { nombre: "Usuario", correo: "..." };

    const viewSolicitudes = document.getElementById('view-solicitudes');
    const viewHistorial = document.getElementById('view-historial');
    const solicitudesList = document.getElementById('solicitudes-list-view');
    const historialList = document.getElementById('talleres-list-view');
    const detailView = document.getElementById('detail-view');
    
    const welcomeMessage = document.getElementById('welcomeMessage');
    const viewComprobanteModal = document.getElementById('viewComprobanteModal');
    const comprobanteImage = document.getElementById('comprobanteImage');
    const closeComprobanteModal = document.getElementById('closeComprobanteModal');

    const ESTADOS = { PENDIENTE: 1, CONFIRMADO_ESPERA: 2, RECHAZADA: 3, EN_REVISION: 4, INSCRITO_COMPLETADO: 5 };

    const addDays = (date, days) => { const r = new Date(date); r.setDate(r.getDate() + days); return r; };
    
    async function fetchWithToken(url, options = {}) {
        const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', ...options.headers };
        const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });
        if (!response.ok) throw new Error(`API Error`);
        const type = response.headers.get("content-type");
        return (type && type.includes("json")) ? response.json() : response.text();
    }

    async function fetchUserProfile() {
        try { 
            const profile = await fetchWithToken(`/perfil/${userId}`);
            userProfileData = profile; 
            if(welcomeMessage) welcomeMessage.textContent = `Bienvenido, ${profile.nombre}`;
        } catch (e) { console.error("Error perfil", e); }
    }

    async function fetchCatalogos() { try { catalogoTalleres = await fetchWithToken(`/talleres`); } catch (e) {} }
    function getTallerName(id) { const taller = catalogoTalleres.find(x => x.idTaller === id); return taller ? taller.nombreTaller : `Taller ${id}`; }

    function getVisualState(solicitud) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const fInicio = new Date(solicitud.fechaAplicarTaller);
        const fFin = solicitud.fechaFin ? new Date(solicitud.fechaFin) : addDays(fInicio, 7);
        if (today < fInicio) return { status: 'proximo', label: 'Próximo' };
        else if (today >= fInicio && today <= fFin) return { status: 'en-curso', label: 'En curso' };
        else return { status: 'completado', label: 'Completado' };
    }

    // --- 1. RENDERIZAR SOLICITUDES (EN TRÁMITE) ---
    function renderSolicitudesEnTramite() {
        // Mostrar todo lo que NO sea completado (incluye estado 4 En Revisión)
        const tramites = allRequests.filter(s => s.idEstado !== ESTADOS.INSCRITO_COMPLETADO);
        solicitudesList.innerHTML = '';

        if (tramites.length === 0) {
            solicitudesList.innerHTML = `<p>${t('error.noRequests')}</p>`;
            return;
        }

        tramites.forEach(s => {
            const nombreTaller = getTallerName(s.idTaller);
            let badgeClass = 'bg-pendiente'; 
            let badgeText = t('workshop.pending');

            if(s.idEstado === ESTADOS.CONFIRMADO_ESPERA) { badgeClass = 'bg-espera'; badgeText = t('workshop.uploadReceipt'); }
            else if(s.idEstado === ESTADOS.EN_REVISION) { badgeClass = 'bg-revision'; badgeText = t('workshop.inReview'); }
            else if(s.idEstado === ESTADOS.RECHAZADA) { badgeClass = 'bg-rechazada'; badgeText = t('workshop.rejected'); }

            const fechaStr = new Date(s.fechaAplicarTaller).toLocaleDateString('es-ES');

            const cardHTML = `
                <div class="tramite-card">
                    <div class="tramite-info">
                        <h5 class="tramite-user-name">${userProfileData.nombre} ${userProfileData.apellidoPaterno || ''}</h5>
                        <div class="tramite-details-row">
                            <div class="tramite-detail-item"><img src="/Imagenes/user.png" class="icon"> <span>${userProfileData.correo || ''}</span></div>
                            <div class="tramite-detail-item"><img src="/Imagenes/marker.png" class="icon"> <span>${s.direccion}</span></div>
                            <div class="tramite-detail-item"><img src="/Imagenes/calendar.png" class="icon"> <span>${fechaStr}</span></div>
                        </div>
                        <span class="tramite-label">${t('workshop.requestedWorkshops')}</span>
                        <span class="taller-pill">${nombreTaller}</span>
                    </div>
                    <div class="tramite-actions">
                        <button class="btn-ver-detalles" data-id="${s.idSolicitudTaller}">${t('workshop.viewDetails')}</button>
                        <div class="status-badge-tramite ${badgeClass}">${badgeText}</div>
                    </div>
                </div>`;
            solicitudesList.innerHTML += cardHTML;
        });
        
        document.querySelectorAll('.btn-ver-detalles').forEach(btn => {
            btn.addEventListener('click', (e) => renderDetailView(e.target.dataset.id));
        });
    }

    // --- 2. RENDERIZAR HISTORIAL (COMPLETADOS) ---
    function renderHistorial(filtro = 'todos') {
        const historial = allRequests.filter(s => s.idEstado === ESTADOS.INSCRITO_COMPLETADO);
        historialList.innerHTML = '';

        const filtradas = historial.filter(s => {
            const visual = getVisualState(s);
            if (filtro === 'todos') return true;
            return visual.status === filtro; 
        });

        if (filtradas.length === 0) {
            historialList.innerHTML = `<p>${t('error.noWorkshops')}</p>`;
            return;
        }

        filtradas.forEach(s => {
            const nombre = getTallerName(s.idTaller);
            const visual = getVisualState(s);
            const impartio = s.nombreAgronomo || 'Ing. Agrónomo';
            const fInicioStr = new Date(s.fechaAplicarTaller).toLocaleDateString('es-ES');
            const fFinStr = s.fechaFin ? new Date(s.fechaFin).toLocaleDateString('es-ES') : '...';

            // ★ CORRECCIÓN: Mostrar enlace "Ver comprobante" en historial ★
            const receiptHTML = s.estadoPagoImagen 
                ? `<div style="margin-top:10px;"><img src="/Imagenes/eye.png" style="width:12px; opacity:0.6;"> <a href="#" class="view-receipt-link" data-url="${s.estadoPagoImagen}">Ver comprobante</a></div>` 
                : '';

            const cardHTML = `
                <div class="workshop-card">
                    <div class="card-body">
                        <p class="taller-label">${t('nav.workshops')}:</p>
                        <h5 class="taller-title">${nombre}</h5>
                        <div class="info-row"><img src="/Imagenes/user.png" class="info-icon"><div><span class="info-label">${t('workshop.taughtBy')}</span><p class="info-text">${impartio}</p></div></div>
                        <div class="info-row"><img src="/Imagenes/marker.png" class="info-icon"><div><span class="info-label">${t('workshop.location')}</span><p class="info-text">${s.direccion}</p></div></div>
                        <div class="expandable-content">
                            <div class="date-info"><p class="info-text">${t('workshop.startDate')} <br> ${fInicioStr}</p><p class="info-text" style="margin-top:5px;">${t('workshop.endDate')} <br> ${fFinStr}</p></div>
                            ${receiptHTML}
                        </div>
                    </div>
                    <div class="toggle-btn-container"><button class="toggle-btn"><span class="btn-text">Ver más</span><span class="toggle-icon">▼</span></button></div>
                    <div class="card-footer footer-${visual.status}">${visual.status === 'completado' ? '✔' : (visual.status === 'en-curso' ? '▶' : '⏱')} ${visual.label}</div>
                </div>`;
            
            const div = document.createElement('div');
            div.innerHTML = cardHTML;
            const cardEl = div.firstElementChild;
            
            const toggleBtn = cardEl.querySelector('.toggle-btn');
            const content = cardEl.querySelector('.expandable-content');
            const btnText = cardEl.querySelector('.btn-text');
            toggleBtn.addEventListener('click', () => {
                content.classList.toggle('open');
                toggleBtn.classList.toggle('open');
                btnText.textContent = content.classList.contains('open') ? t('button.viewLess') : t('button.viewMore');
            });
            
            const link = cardEl.querySelector('.view-receipt-link');
            if(link) {
                link.addEventListener('click', (e) => { e.preventDefault(); comprobanteImage.src = e.target.dataset.url; viewComprobanteModal.classList.remove('hidden'); });
            }
            historialList.appendChild(cardEl);
        });
    }

    async function loadAllData() {
        try {
            allRequests = await fetchWithToken(`/solicitudtaller/misolicitudes`);
            const activeView = document.querySelector('.nav-button.active').dataset.view;
            if(activeView === 'solicitudes') renderSolicitudesEnTramite();
            else {
                const filter = document.querySelector('.filter-btn.active').dataset.filter;
                renderHistorial(filter);
            }
        } catch (e) { console.error(e); }
    }

    document.querySelector('.workshops-nav').addEventListener('click', (e) => {
        if (e.target.matches('.nav-button')) {
            document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const view = e.target.dataset.view;
            
            viewSolicitudes.classList.toggle('hidden', view !== 'solicitudes');
            viewHistorial.classList.toggle('hidden', view !== 'historial');
            
            if (view === 'historial') {
                document.querySelector('.filter-buttons .filter-btn[data-filter="todos"]').click();
            } else {
                renderSolicitudesEnTramite();
            }
        }
    });

    document.querySelector('.filter-buttons').addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderHistorial(e.target.dataset.filter);
        }
    });

    async function renderDetailView(id) {
        const s = allRequests.find(x => x.idSolicitudTaller == id);
        if (!s) return;
        viewSolicitudes.classList.add('hidden');
        viewHistorial.classList.add('hidden');
        detailView.classList.remove('hidden');

        let contentHTML = '';
        if (s.idEstado === ESTADOS.CONFIRMADO_ESPERA) {
            contentHTML = `<div class="alert-box" style="background:#fff3cd; padding:15px; border-radius:8px; margin-bottom:20px;"><p><strong>¡Solicitud Aceptada!</strong></p><p>Por favor realiza el pago y sube el comprobante.</p></div><input type="file" id="file-input-${s.idSolicitudTaller}" class="hidden" accept="image/*"><button class="btn-action-box" data-for-input="file-input-${s.idSolicitudTaller}" style="width:100%; margin-bottom:10px;">📷 Seleccionar Comprobante</button><div class="image-preview-container hidden" style="text-align:center; margin-bottom:10px;"><img class="image-preview" src="" style="max-width:100%; max-height:200px; border-radius:8px;"></div><button class="btn btn-update hidden" data-id="${s.idSolicitudTaller}" style="width:100%; background-color:#1C6E3E; color:white;">Enviar Comprobante</button>`;
        } else if (s.idEstado === ESTADOS.EN_REVISION) {
             contentHTML = `<div style="text-align:center; padding:20px;"><p><em>Comprobante enviado. Esperando validación.</em></p><button class="btn btn-secondary view-receipt" data-url="${s.estadoPagoImagen}">Ver mi comprobante</button></div>`;
        } else {
            contentHTML = `<p>${t('status.currentStatus')} ${s.idEstado === ESTADOS.PENDIENTE ? t('workshop.pending') : (s.idEstado === ESTADOS.RECHAZADA ? t('workshop.rejected') : t('status.enrolled'))}</p>`;
        }

        detailView.innerHTML = `<button class="btn" id="backToListBtn" style="margin-bottom:20px;">${t('button.back')}</button><div class="detail-card"><h3>${getTallerName(s.idTaller)}</h3><p>${t('label.location')} ${s.direccion}</p><p>${t('label.date')} ${s.fechaAplicarTaller}</p><hr style="margin:20px 0; border:0; border-top:1px solid #eee;">${contentHTML}</div>`;
    }

    document.querySelector('.main-content').addEventListener('click', async (e) => {
        if (e.target.matches('.btn-details')) renderDetailView(e.target.dataset.id);
        
        if (e.target.id === 'backToListBtn') {
            detailView.classList.add('hidden');
            const activeView = document.querySelector('.nav-button.active').dataset.view;
            // Regresar a la vista correcta
            if (activeView === 'solicitudes') viewSolicitudes.classList.remove('hidden');
            else viewHistorial.classList.remove('hidden');
        }
        if (e.target.closest('.btn-action-box')) document.getElementById(e.target.closest('.btn-action-box').dataset.forInput).click();
        
        // --- LÓGICA DE SUBIDA Y RECARGA ---
        if (e.target.matches('.btn-update')) {
             const id = e.target.dataset.id;
             const imgBase64 = document.querySelector('.image-preview').src; 
             try {
                 await fetchWithToken(`/solicitudtaller/${id}/comprobante`, { method: 'PATCH', body: JSON.stringify({ imagen: imgBase64 }) });
                 alert('Comprobante enviado.');
                 detailView.classList.add('hidden');
                 
                 // Recargar datos
                 await loadAllData();
                 
                 // IMPORTANTE: Volver a la vista de SOLICITUDES, donde aparecerá como "En Revisión"
                 viewSolicitudes.classList.remove('hidden');
                 
             } catch (error) { alert("Error al subir."); }
        }
        
        if (e.target.matches('.view-receipt')) { e.preventDefault(); comprobanteImage.src = e.target.dataset.url; viewComprobanteModal.classList.remove('hidden'); }
    });

    detailView.addEventListener('change', (e) => {
        if (e.target.matches('input[type="file"]')) {
             const file = e.target.files[0];
             if(file) {
                 const reader = new FileReader();
                 reader.onload = (ev) => {
                     const container = document.querySelector('.image-preview-container');
                     container.querySelector('img').src = ev.target.result;
                     container.classList.remove('hidden');
                     document.querySelector('.btn-update').classList.remove('hidden');
                 };
                 reader.readAsDataURL(file);
             }
        }
    });

    if (closeComprobanteModal) closeComprobanteModal.addEventListener('click', () => viewComprobanteModal.classList.add('hidden'));

    await fetchUserProfile(); 
    await fetchCatalogos();   
    await loadAllData();      
});