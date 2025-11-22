document.addEventListener('DOMContentLoaded', async () => {
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual')); 

    const STATUS_IDS = {
        PENDIENTE: 1, 
        ACEPTADA: 2, 
        REVISION: 4, 
        COMPLETADO: 5, 
        RECHAZADA: 3 
    };

    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        localStorage.clear(); window.location.href = '../../index.html'; return;
    }
    const authToken = authInfo.token;

    // --- ELEMENTOS DOM ---
    const requestListContainer = document.getElementById('request-list');
    const rejectionModal = document.getElementById('rejectionModal');
    const receiptModal = document.getElementById('receiptModal');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const acceptRejectionBtn = document.getElementById('acceptRejection');
    const cancelRejectionBtn = document.getElementById('cancelRejection');
    const closeReceiptBtn = document.getElementById('closeReceipt');
    
    let currentSolicitud = { id: null, type: null }; 
    let allSolicitudes = []; 

    // --- API HELPERS ---
    async function fetchWithAuth(url, options = {}) {
        const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', ...(options.headers || {}) };
        return await fetch(url, { ...options, headers });
    }
    const openModal = (m) => m.classList.remove('hidden');
    const closeModal = (m) => m.classList.add('hidden');
    
    const mapStatusIdToDisplay = (id) => {
        switch (id) {
            case STATUS_IDS.PENDIENTE: return { text: t('requests.pending'), class: 'status-pendiente' };
            case STATUS_IDS.ACEPTADA: return { text: t('requests.approved'), class: 'status-aceptada' };
            case STATUS_IDS.RECHAZADA: return { text: t('requests.rejected'), class: 'status-rechazada' };
            case STATUS_IDS.COMPLETADO: return { text: t('common.completed'), class: 'status-completado' };
            case STATUS_IDS.REVISION: return { text: 'En Revisión', class: 'status-revision' };
            default: return { text: 'Desconocido', class: 'status-revision' };
        }
    };

    async function loadProfileAndGreeting() {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });
            if (response.ok) {
                const user = await response.json();
                if (welcomeMessage) welcomeMessage.textContent = `${t('greeting.welcome')}, ${user.nombre}`;
            }
        } catch (error) {}
    }

    // --- FETCH DATOS ---
    async function fetchSolicitudes() {
        requestListContainer.innerHTML = `<p class="loading-message">${t('loading.requests')}</p>`;
        try {
            const response = await fetch(`${API_BASE_URL}/solicitudesTallerAsesoria`, { method: 'GET', headers: { 'Authorization': `Bearer ${authToken}` } });
            if (!response.ok) throw new Error(`Error ${response.status}`);
            const data = await response.json();

            const asesorias = data.solicitudAsesorias.map(s => ({ ...s, id: s.idSolicitud, type: 'asesoria', nombreRiego: s.nombreRiego || 'N/A' }));
            const talleres = data.solicitudTalleres.map(s => ({ ...s, id: s.idSolicitudTaller, type: 'taller', comentario: s.comentario || 'N/A', estadoPagoImagen: s.estadoPagoImagen }));
            
            allSolicitudes = [...asesorias, ...talleres];
            renderSolicitudes();
        } catch (error) {
            requestListContainer.innerHTML = `<p class="error-message">${t('common.error')}: ${error.message}</p>`;
        }
    }

    // --- RENDERIZADO ---
    const renderSolicitudes = () => {
        const filterType = document.querySelector('.filter-btn.active').dataset.filter;
        requestListContainer.innerHTML = '';
        let filtered = allSolicitudes;
        if (filterType !== 'all') filtered = allSolicitudes.filter(s => s.type === filterType);

        if (filtered.length === 0) {
            requestListContainer.innerHTML = `<p>${t('error.noPendingRequests')}</p>`;
            return;
        }

        filtered.forEach(solicitud => {
            // Debug: Verifica en consola si el ID de estado es correcto (Debe ser 4 para En Revisión)
            console.log(`Solicitud ${solicitud.id} (${solicitud.type}) - Estado: ${solicitud.idEstado}`);

            const card = document.createElement('div');
            card.className = 'request-card';
            card.dataset.id = solicitud.id;
            card.dataset.type = solicitud.type;
            const estadoDisplay = mapStatusIdToDisplay(solicitud.idEstado);

            const clienteDisplay = solicitud.nombreAgricultor ? solicitud.nombreAgricultor : `Agricultor ID: ${solicitud.idAgricultor}`;

            const summaryDetails = `
                <div class="info-item"><img src="/Imagenes/user.png" class="info-icon"> ${clienteDisplay}</div>
                <div class="info-item"><img src="/Imagenes/marker.png" class="info-icon"> ${solicitud.direccionTerreno || solicitud.direccion || 'No especificada'}</div>
                <div class="info-item"><img src="/Imagenes/calendar.png" class="info-icon"> ${new Date(solicitud.fechaSolicitud).toLocaleDateString()}</div>`;

            let tagsHTML = '';
            let detailsHTML = '';
            
            if (solicitud.type === 'asesoria') {
                const cultivos = (solicitud.cultivos && solicitud.cultivos.length > 0) 
                    ? solicitud.cultivos.map(c => c.nombreCultivo).join(', ') 
                    : 'N/A';
                
                tagsHTML = `<div class="summary-tags"><span>Cultivos:</span><span class="request-tag">${cultivos}</span></div>`;
                detailsHTML = `
                    <div class="details-grid">
                        <div class="info-group"><label>${t('label.irrigationType')}</label><p>${solicitud.nombreRiego}</p></div>
                        <div class="info-group"><label>${t('label.surface')}</label><p>${solicitud.superficieTotal}</p></div>
                        <div class="info-group"><label>${t('label.usesMachinery')}</label><p>${solicitud.usoMaquinaria ? `${t('form.yes')} (${solicitud.nombreMaquinaria})` : t('form.no')}</p></div>
                        <div class="info-group"><label>${t('label.hasPlague')}</label><p>${solicitud.tienePlaga ? `${t('form.yes')} (${solicitud.descripcionPlaga})` : t('form.no')}</p></div>
                        <div class="info-group motivo-box"><label>${t('label.reason')}</label><p>${solicitud.motivoAsesoria}</p></div>
                    </div>`;
            } else { 
                // --- VISTA DETALLE TALLER ---
                tagsHTML = `<div class="summary-tags"><span>${t('label.workshopId')}</span><span class="request-tag">${solicitud.nombreTaller}</span></div>`;
                detailsHTML = `
                    <div class="details-grid">
                        <div class="info-group"><label>${t('label.applicationDate')}</label><p>${solicitud.fechaAplicarTaller}</p></div>
                        <div class="info-group"><label>${t('label.comment')}</label><p>${solicitud.comentario}</p></div>
                        <div class="info-group"><label>${t('label.state')}</label><p>${estadoDisplay.text}</p></div>
                    </div>`;
                
                if (solicitud.idEstado === STATUS_IDS.REVISION && solicitud.estadoPagoImagen) {
                    detailsHTML += `<div class="taller-flow-box"><p>${t('status.receiptReceived')}</p><button class="btn btn-secondary view-receipt-btn" data-img-src="${solicitud.estadoPagoImagen}">${t('status.viewReceipt')}</button></div>`;
                }
                if(solicitud.idEstado === STATUS_IDS.ACEPTADA) {
                    detailsHTML += `<div class="taller-flow-box"><p style="color:#17A2B8;">${t('status.waitingPayment')}</p></div>`;
                }
            }
            
            let actionsHTML = '';

            // CASO 1: PENDIENTE
            if (solicitud.idEstado === STATUS_IDS.PENDIENTE) {
                actionsHTML = `
                    <button class="btn btn-details">${t('button.viewMore')}</button>
                    <button class="btn btn-accept" data-id="${solicitud.id}" data-type="${solicitud.type}">${t('button.confirm')}</button>
                    <button class="btn btn-reject" data-id="${solicitud.id}" data-type="${solicitud.type}">${t('button.reject')}</button>
                `;
            } 
            // CASO 2: EN REVISIÓN (Ver Pago)
            else if (solicitud.idEstado === STATUS_IDS.REVISION && solicitud.type === 'taller') {
                actionsHTML = `
                    <button class="btn btn-details">${t('button.viewMore')}</button>
                    <button class="btn btn-secondary view-receipt-btn" data-img-src="${solicitud.estadoPagoImagen}" style="width:100%; margin-bottom:5px;">${t('button.viewPayment')}</button>
                    <button class="btn btn-accept btn-validate-payment" data-id="${solicitud.id}" data-type="${solicitud.type}" style="background-color:#28a745;">${t('button.validateInscription')}</button>
                    <button class="btn btn-reject" data-id="${solicitud.id}" data-type="${solicitud.type}">${t('button.rejectPayment')}</button>
                `;
            }
            // CASO 3: OTROS
            else {
                actionsHTML = `<button class="btn btn-details">${t('button.viewMore')}</button><button class="btn btn-status-badge ${estadoDisplay.class}" disabled>${estadoDisplay.text}</button>`;
            }

            const tituloTarjeta = `Solicitud de ${solicitud.type.charAt(0).toUpperCase() + solicitud.type.slice(1)} #${solicitud.id}`;

            card.innerHTML = `
                <div class="card-summary">
                    <div class="summary-info">
                        <h5>${tituloTarjeta}</h5>
                        <div class="summary-details">${summaryDetails}</div>
                        ${tagsHTML}
                    </div>
                    <div class="summary-actions">${actionsHTML}</div>
                </div>
                <div class="details-view">${detailsHTML}</div>`;
            
            requestListContainer.appendChild(card);
        });
    };

    async function handleStatusUpdate(id, type, newStatusId) {
        let endpoint = (type === 'asesoria') ? 'solicitudasesoria' : 'solicitudtaller';
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/${endpoint}/${id}/${newStatusId}`, { method: 'PATCH' });
            if (!response.ok) throw new Error(await response.text());
            await fetchSolicitudes(); 
            closeModal(rejectionModal);
        } catch (error) { alert(`Error: ${error.message}`); }
    }

    // --- EVENTOS ---
    document.querySelector('.filter-buttons').addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderSolicitudes();
        }
    });

    requestListContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.request-card');
        if (!card) return;
        const solicitudId = parseInt(card.dataset.id);
        const solicitudType = card.dataset.type;

        if (e.target.matches('.btn-details')) {
            e.preventDefault();
            const isExpanded = card.classList.toggle('expanded');
            e.target.textContent = isExpanded ? t('button.viewLess') : t('button.viewMore');
        }

        // Aceptar
        if (e.target.matches('.btn-accept') && !e.target.classList.contains('btn-validate-payment')) {
            const newState = STATUS_IDS.ACEPTADA;
            handleStatusUpdate(solicitudId, solicitudType, newState);
        }

        // Rechazar
        if (e.target.matches('.btn-reject')) { 
            currentSolicitud = { id: solicitudId, type: solicitudType }; 
            openModal(rejectionModal); 
        }

        // Validar Pago
        if (e.target.matches('.btn-validate-payment')) {
             if(confirm(t('confirm.paymentReception'))) {
                 handleStatusUpdate(solicitudId, solicitudType, STATUS_IDS.COMPLETADO);
             }
        }
        
        // Ver Recibo
        if (e.target.matches('.view-receipt-btn')) { 
            const imgSrc = e.target.dataset.imgSrc;
            if(imgSrc) {
                document.getElementById('receiptImage').src = imgSrc; 
                openModal(receiptModal); 
            } else {
                alert(t('error.loadReceiptImage'));
            }
        }
    });

    cancelRejectionBtn.addEventListener('click', () => closeModal(rejectionModal));
    acceptRejectionBtn.addEventListener('click', () => { if (currentSolicitud.id) handleStatusUpdate(currentSolicitud.id, currentSolicitud.type, STATUS_IDS.RECHAZADA); });
    closeReceiptBtn.addEventListener('click', () => closeModal(receiptModal));

    await loadProfileAndGreeting(); 
    await fetchSolicitudes();
});