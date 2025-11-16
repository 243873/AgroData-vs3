document.addEventListener('DOMContentLoaded', async () => {
    // --- URL DEL SERVIDOR y AUTENTICACIÓN ---
    const API_BASE_URL = 'http://localhost:7000';
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual')); 

    // Mapeo de IDs de estado de la base de datos a un texto/acción:
    const STATUS_IDS = {
        PENDIENTE: 1, 
        ACEPTADA: 2, 
        REVISION: 4,
        COMPLETADO: 5,  
        Rechazada: 3, 
    };

    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        console.error("Acceso denegado o sesión inválida. Redirigiendo a login.");
        localStorage.clear();
        window.location.href = '../../index.html';
        return;
    }
    
    const authToken = authInfo.token;

    // --- ELEMENTOS DEL DOM ---
    const requestListContainer = document.getElementById('request-list');
    const rejectionModal = document.getElementById('rejectionModal');
    const receiptModal = document.getElementById('receiptModal');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const acceptRejectionBtn = document.getElementById('acceptRejection');
    const cancelRejectionBtn = document.getElementById('cancelRejection');
    const closeReceiptBtn = document.getElementById('closeReceipt');
    
    let currentSolicitud = { id: null, type: null }; // Almacena la solicitud para el modal de rechazo
    let allSolicitudes = []; // Almacena todos los datos crudos para el filtrado


    // --- FUNCIONES HELPER (API) ---

    async function fetchWithAuth(url, options = {}) {
        const headers = {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        const finalOptions = { ...options, headers };
        return await fetch(url, finalOptions);
    }
    
    // --- Lógica de Modales ---
    const openModal = (m) => m.classList.remove('hidden');
    const closeModal = (m) => m.classList.add('hidden');

    /**
     * Mapea el ID de estado del backend a una clase CSS y texto descriptivo.
     */
    const mapStatusIdToDisplay = (id) => {
        switch (id) {
            case STATUS_IDS.PENDIENTE: return { text: 'Pendiente', class: 'status-pendiente' };
            case STATUS_IDS.ACEPTADA: return { text: 'Aceptada / En Curso', class: 'status-aceptada' };
            case STATUS_IDS.RECHAZADA: return { text: 'Rechazada', class: 'status-rechazada' };
            case STATUS_IDS.COMPLETADO: return { text: 'Completado', class: 'status-completado' };
            default: return { text: 'En Revisión', class: 'status-revision' };
        }
    };

    /**
     * Carga el nombre del usuario y actualiza el saludo.
     */
    async function loadProfileAndGreeting() {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });
            if (response.ok) {
                const user = await response.json();
                if (welcomeMessage) welcomeMessage.textContent = `Bienvenido, ${user.nombre}`;
            }
        } catch (error) {
            console.error('Error al cargar saludo:', error);
        }
    }


    // --- 1. FUNCIÓN DE FETCH Y NORMALIZACIÓN DE DATOS ---

    /**
     * Obtiene todas las solicitudes pendientes de Asesoría y Taller.
     */
    async function fetchSolicitudes() {
        requestListContainer.innerHTML = '<p class="loading-message">Cargando solicitudes pendientes...</p>';
        try {
            // Llama al endpoint combinado
            const response = await fetch(`${API_BASE_URL}/solicitudesTallerAsesoria`, { method: 'GET', headers: { 'Authorization': `Bearer ${authToken}` } });

            if (response.status === 403) {
                requestListContainer.innerHTML = '<p class="error-message">Acceso denegado: Solo el Agrónomo puede ver esta información.</p>';
                return;
            }
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Normalizar y combinar los datos:
            const asesorias = data.solicitudAsesorias.map(s => ({ 
                ...s, 
                id: s.idSolicitud, 
                type: 'asesoria',
                nombreRiego: s.nombreRiego || 'N/A', // Se usa en los detalles
            }));
            const talleres = data.solicitudTalleres.map(s => ({ 
                ...s, 
                id: s.idSolicitudTaller, 
                type: 'taller',
                comentario: s.comentario || 'N/A',
                estadoPagoImagen: s.estadoPagoImagen,
            }));
            
            allSolicitudes = [...asesorias, ...talleres];
            renderSolicitudes();

        } catch (error) {
            console.error('Error al obtener solicitudes:', error);
            requestListContainer.innerHTML = `<p class="error-message">Error de conexión con el servidor. (${error.message})</p>`;
        }
    }

    // --- 2. FUNCIÓN DE RENDERIZADO DE SOLICITUDES ---

// ... (Todo el código anterior, como fetchWithAuth, loadProfileAndGreeting, fetchSolicitudes, etc., queda igual) ...

    // --- 2. FUNCIÓN DE RENDERIZADO DE SOLICITUDES ---

    const renderSolicitudes = () => {
        const filterType = document.querySelector('.filter-btn.active').dataset.filter;
        requestListContainer.innerHTML = '';
        
        let filteredSolicitudes = allSolicitudes;
        
        // Filtrar por tipo
        if (filterType !== 'all') {
            filteredSolicitudes = allSolicitudes.filter(s => s.type === filterType);
        }

        if (filteredSolicitudes.length === 0) {
            requestListContainer.innerHTML = `<p>No hay solicitudes de ${filterType === 'all' ? 'ningún tipo' : filterType} pendientes.</p>`;
            return;
        }

        filteredSolicitudes.forEach(solicitud => {
            const card = document.createElement('div');
            card.className = 'request-card'; // Quitamos 'expanded'
            card.dataset.id = solicitud.id;
            card.dataset.type = solicitud.type;

            const estadoDisplay = mapStatusIdToDisplay(solicitud.idEstado);

            const summaryDetails = `
                <div class="info-item"><img src="/Imagenes/user.png" class="info-icon"> Agricultor ID: ${solicitud.idAgricultor}</div>
                <div class="info-item"><img src="/Imagenes/marker.png" class="info-icon"> ${solicitud.direccionTerreno || solicitud.direccion || 'No especificada'}</div>
                <div class="info-item"><img src="/Imagenes/calendar.png" class="info-icon"> ${new Date(solicitud.fechaSolicitud).toLocaleDateString()}</div>`;

            let tagsHTML = '';
            let detailsHTML = '';
            let isActionable = solicitud.idEstado === STATUS_IDS.PENDIENTE;

            if (solicitud.type === 'asesoria') {
                const cultivos = solicitud.cultivos ? solicitud.cultivos.map(c => c.nombreCultivo).join(', ') : 'N/A';
                tagsHTML = `<div class="summary-tags"><span>Cultivos:</span><span class="request-tag">${cultivos}</span></div>`;
                detailsHTML = `
                    <div class="details-grid">
                        <div class="info-group"><label>Tipo de Riego:</label><p>${solicitud.nombreRiego}</p></div>
                        <div class="info-group"><label>Superficie (Ha):</label><p>${solicitud.superficieTotal}</p></div>
                        <div class="info-group"><label>Usa Maquinaria:</label><p>${solicitud.usoMaquinaria ? `Sí (${solicitud.nombreMaquinaria})` : 'No'}</p></div>
                        <div class="info-group"><label>Tiene Plaga:</label><p>${solicitud.tienePlaga ? `Sí (${solicitud.descripcionPlaga})` : 'No'}</p></div>
                        <div class="info-group motivo-box"><label>Motivo:</label><p>${solicitud.motivoAsesoria}</p></div>
                    </div>`;

            } else { // Taller
                tagsHTML = `<div class="summary-tags"><span>Taller ID:</span><span class="request-tag">${solicitud.idTaller}</span></div>`;
                detailsHTML = `
                    <div class="details-grid">
                        <div class="info-group"><label>Fecha Aplicación:</label><p>${solicitud.fechaAplicarTaller}</p></div>
                        <div class="info-group"><label>Comentario:</label><p>${solicitud.comentario}</p></div>
                        <div class="info-group"><label>Estado de Pago:</label><p>${solicitud.estadoPagoImagen ? 'Comprobante Subido' : 'Pendiente'}</p></div>
                    </div>`;

                if (solicitud.estadoPagoImagen) {
                    detailsHTML += `<div class="taller-flow-box">
                        <button class="btn btn-secondary view-receipt-btn" data-img-src="${solicitud.estadoPagoImagen}">Ver Comprobante</button>
                        ${isActionable ? '' : `<button class="btn btn-primary btn-verify-taller" data-id="${solicitud.id}" data-type="${solicitud.type}">Verificar y Completar</button>`}
                    </div>`;
                    isActionable = false; 
                }
                
                if(solicitud.idEstado === STATUS_IDS.ACEPTADA && !solicitud.estadoPagoImagen) {
                    detailsHTML += `<div class="taller-flow-box"><p>Esperando el comprobante de pago del cliente...</p></div>`;
                    isActionable = false;
                }
            }
            
            let actionsHTML = '';
            if (isActionable) {
                actionsHTML = `
                    <button class="btn btn-details">Ver más</button>
                    <button class="btn btn-accept" data-id="${solicitud.id}" data-type="${solicitud.type}">Aceptar</button>
                    <button class="btn btn-reject" data-id="${solicitud.id}" data-type="${solicitud.type}">Rechazar</button>`;
            } else {
                actionsHTML = `<button class="btn btn-details">Ver más</button><button class="btn btn-status-badge ${estadoDisplay.class}" disabled>${estadoDisplay.text}</button>`;
            }

            card.innerHTML = `
                <div class="card-summary">
                    <div class="summary-info">
                        <h5>Solicitud de ${solicitud.type.charAt(0).toUpperCase() + solicitud.type.slice(1)} (ID: ${solicitud.id})</h5>
                        <div class="summary-details">${summaryDetails}</div>
                        ${tagsHTML}
                    </div>
                    <div class="summary-actions">${actionsHTML}</div>
                </div>
                <div class="details-view">${detailsHTML}</div>`;
            
            requestListContainer.appendChild(card);
        });
    };

    // --- 3. FUNCIÓN DE ACTUALIZACIÓN DE ESTADO ---
    // (handleStatusUpdate sin cambios)
    async function handleStatusUpdate(id, type, newStatusId) {
        let endpoint = (type === 'asesoria') ? 'solicitudasesoria' : 'solicitudtaller';
        let url = `${API_BASE_URL}/${endpoint}/${id}/${newStatusId}`;
        
        try {
            const response = await fetchWithAuth(url, { method: 'PATCH' });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error en API: ${errorText}`);
            }

            await fetchSolicitudes(); 
            closeModal(rejectionModal);
            
        } catch (error) {
            console.error(`Error al actualizar el estado:`, error);
            alert(`Error al actualizar el estado: ${error.message}`);
        }
    }


    // --- 4. MANEJO DE EVENTOS ---
    
    // 1. Filtros (Sin cambios)
    document.querySelector('.filter-buttons').addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderSolicitudes();
        }
    });

    // --- ★ MODIFICACIÓN: Listener de Acciones ---
    // 2. Acciones en las tarjetas (Delegación)
    requestListContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.request-card');
        if (!card) return;

        const solicitudId = parseInt(card.dataset.id);
        const solicitudType = card.dataset.type;

        // --- ★ CORRECCIÓN "VER MÁS" ★ ---
        if (e.target.matches('.btn-details')) {
            e.preventDefault();
            // Añade o quita la clase 'expanded' a la tarjeta padre
            const isExpanded = card.classList.toggle('expanded');
            // Cambia el texto del botón
            e.target.textContent = isExpanded ? 'Ver menos' : 'Ver más';
        }
        // --- ★ FIN DE CORRECCIÓN ★ ---
        
        if (e.target.matches('.btn-accept')) {
            handleStatusUpdate(solicitudId, solicitudType, STATUS_IDS.ACEPTADA);
        }
        
        if (e.target.matches('.btn-reject')) {
            currentSolicitud = { id: solicitudId, type: solicitudType };
            openModal(rejectionModal);
        }
        
        if (e.target.matches('.btn-verify-taller')) {
            handleStatusUpdate(solicitudId, solicitudType, STATUS_IDS.COMPLETADO);
        }
        
        if (e.target.matches('.view-receipt-btn')) {
            const imgSrc = e.target.dataset.imgSrc;
            document.getElementById('receiptImage').src = imgSrc;
            openModal(receiptModal);
        }
    });

    // 3. Modal de Rechazo (Sin cambios)
    cancelRejectionBtn.addEventListener('click', () => closeModal(rejectionModal));
    acceptRejectionBtn.addEventListener('click', () => {
        if (currentSolicitud.id) {
            handleStatusUpdate(currentSolicitud.id, currentSolicitud.type, STATUS_IDS.RECHAZADA);
        }
    });
    
    // 4. Cerrar Modal de Comprobante (Sin cambios)
    closeReceiptBtn.addEventListener('click', () => closeModal(receiptModal));


    // --- INICIALIZACIÓN ---
    await loadProfileAndGreeting(); 
    await fetchSolicitudes();
});