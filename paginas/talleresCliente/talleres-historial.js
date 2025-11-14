document.addEventListener('DOMContentLoaded', async () => {
    // --- CONFIGURACIÓN Y VERIFICACIÓN DE USUARIO ---
    const API_BASE_URL = "http://localhost:7000";
    
    const authString = localStorage.getItem('usuarioActual');
    const usuarioActual = authString ? JSON.parse(authString) : null;

    if (!usuarioActual || !usuarioActual.id || !usuarioActual.rol || !usuarioActual.token) { 
        console.error("No se encontró 'usuarioActual' o está incompleto. Redirigiendo a login.");
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/index.html'; 
        return; 
    }
    
    const userId = usuarioActual.id;
    const userRol = usuarioActual.rol;
    const authToken = usuarioActual.token;

    // Esta variable se llenará con la info real de la API
    let currentUserProfile = { id: parseInt(userId), nombre: "Usuario" }; 
    let catalogoTalleres = [];

    // --- MAPEO DE ESTADOS (Sin cambios) ---
    const ESTADO_MAP = {
        1: 'Pendiente',
        2: 'Aceptada',
        3: 'Rechazada', 
        4: 'Revision',
        5: 'Completado'
    };
    
    function getEstadoName(idEstado) {
        return ESTADO_MAP[idEstado] || 'Desconocido';
    }
    
    function getEstadoClass(idEstado) {
        return (ESTADO_MAP[idEstado] || 'desconocido').toLowerCase().replace(/ /g, '-');
    }

    // --- ELEMENTOS DEL DOM ---
    const solicitudesView = document.getElementById('solicitudes-view');
    const historialView = document.getElementById('historial-view');
    const listView = document.getElementById('list-view');
    const detailView = document.getElementById('detail-view');
    const historialCardsContainer = document.getElementById('historial-cards-container');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const viewComprobanteModal = document.getElementById('viewComprobanteModal');
    const comprobanteImage = document.getElementById('comprobanteImage');
    const closeComprobanteModal = document.getElementById('closeComprobanteModal');
    
    // ===================================
    // --- LÓGICA DE LA API (FETCH) ---
    // ===================================

    /**
     * Función fetch genérica que ya incluye el token de autorización
     */
    async function fetchWithToken(url, options = {}) {
        const defaultHeaders = {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        };
        
        const finalOptions = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        };

        // NOTA: Esta es la llamada que fallará por CORS hasta que se arregle el backend
        const response = await fetch(`${API_BASE_URL}${url}`, finalOptions);

        if (!response.ok) {
            if (response.status === 401) { // Token inválido o expirado
                window.location.href = '/index.html';
            }
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        // Maneja respuestas que no son JSON (como un PATCH exitoso)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return response.text(); // Devuelve texto si no es JSON
        }
    }

    /**
     * Carga el perfil del usuario para obtener el nombre
     */
    async function fetchUserProfile() {
        try {
            // (GET /perfil/:id)
            const userProfile = await fetchWithToken(`/perfil/${userId}`);
            currentUserProfile = userProfile; // Guardamos el perfil completo
            welcomeMessage.textContent = `Bienvenido, ${userProfile.nombre}`;
        } catch (error) {
            console.error("Error al cargar perfil:", error);
            // Fallback por si falla la carga del perfil
            welcomeMessage.textContent = `Bienvenido, Usuario (ID: ${userId})`;
        }
    }

    /**
     * Carga el catálogo de talleres para poder mostrar los nombres.
     */
    async function fetchCatalogos() {
        try {
            // (GET /talleres)
            catalogoTalleres = await fetchWithToken(`/talleres`);
        } catch (e) {
            console.error("Error cargando catálogo talleres", e);
        }
    }

    function getTallerName(idTaller) {
        const taller = catalogoTalleres.find(t => t.idTaller === idTaller);
        return taller ? taller.nombreTaller : `ID Taller ${idTaller}`;
    }

    /**
     * Obtiene todas las solicitudes de taller del usuario
     */
    async function getAllSolicitudes() {
        try {
            // (GET /solicitudtaller/misolicitudes)
            return await fetchWithToken(`/solicitudtaller/misolicitudes`);
        } catch (error) {
            console.error('Error al obtener solicitudes de taller:', error);
            listView.innerHTML = `<p class="error-message">Error al cargar las solicitudes: ${error.message}. (Probable error de CORS)</p>`;
            return [];
        }
    }

    /**
     * Actualiza el estado de una solicitud usando PATCH.
     */
    async function updateSolicitudEstado(solicitudId, nuevoEstado) {
        try {
            // (PATCH /solicitudtaller/:id/:estado)
            await fetchWithToken(`/solicitudtaller/${solicitudId}/${nuevoEstado}`, {
                method: 'PATCH'
            });
            return true;
        } catch (error) {
            console.error('Error al actualizar estado:', error);
            alert(`Error al actualizar el estado: ${error.message}`);
            return false;
        }
    }
    
    // =======================================
    // --- LÓGICA DE RENDERIZADO (ASYNC) ---
    // =======================================
    
    async function renderSolicitudesListView() {
        listView.innerHTML = '<p>Cargando solicitudes...</p>';
        const allSolicitudes = await getAllSolicitudes();
        
        // Filtrar por estados activos: 1 (Pendiente), 2 (Aceptada), 4 (En Revisión)
        const misSolicitudes = allSolicitudes.filter(s => s.idEstado === 1 || s.idEstado === 2 || s.idEstado === 4);

        if (misSolicitudes.length === 0) { 
            listView.innerHTML = '<p>No tienes solicitudes de talleres activas.</p>'; 
            return; 
        }

        listView.innerHTML = ''; // Limpiar "Cargando..."
        misSolicitudes.forEach(solicitud => {
            // Mapeamos los campos del modelo SolicitudTaller
            const nombreTaller = getTallerName(solicitud.idTaller);
            const estadoNombre = getEstadoName(solicitud.idEstado);
            const estadoClass = getEstadoClass(solicitud.idEstado);
            
            // Definir colores por estado
            let estadoColor = '';
            switch(solicitud.idEstado) {
                case 1: estadoColor = '#FFA500'; break; // Naranja - Pendiente
                case 2: estadoColor = '#4CAF50'; break; // Verde - Aceptada
                case 4: estadoColor = '#2196F3'; break; // Azul - En Revisión
                default: estadoColor = '#999';
            }

            const card = `
                <div class="solicitud-card">
                    <div class="card-info">
                        <div>
                            <h5>${nombreTaller}</h5>
                            <div class="card-info-details">
                                <p><img src="/Imagenes/user.png" class="icon"> ${currentUserProfile.nombre || 'Yo'}</p>
                                <p><img src="/Imagenes/location.png" class="icon"> ${solicitud.direccion}</p>
                                <p><img src="/Imagenes/calendar.png" class="icon"> ${solicitud.fechaAplicarTaller}</p>
                            </div>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-details" data-id="${solicitud.idSolicitudTaller}">Ver Detalles</button>
                        <div class="status-badge" style="background-color: ${estadoColor}; border-color: ${estadoColor};">${estadoNombre}</div>
                    </div>
                </div>`;
            listView.innerHTML += card;
        });
    }

    async function renderDetailView(solicitudId) { 
        // No necesitamos llamar a la API de nuevo, pero lo hacemos
        // para asegurar que los datos estén frescos.
        const allSolicitudes = await getAllSolicitudes(); 
        const solicitud = allSolicitudes.find(s => s.idSolicitudTaller == solicitudId);
        if (!solicitud) return;

        // Mapeamos campos del modelo SolicitudTaller
        const fechaInicio = new Date(solicitud.fechaAplicarTaller + 'T00:00:00');
        const fechaFinal = solicitud.fechaFin ? new Date(solicitud.fechaFin + 'T00:00:00') : new Date(fechaInicio);
        if (!solicitud.fechaFin) {
            fechaFinal.setDate(fechaInicio.getDate() + 7); // Asumir 7 días si no hay fechaFin
        }
        const fechaFinalFormateada = fechaFinal.toISOString().split('T')[0];
        
        const nombreTaller = getTallerName(solicitud.idTaller);
        const estadoId = solicitud.idEstado;

        listView.classList.add('hidden');
        detailView.classList.remove('hidden');

        let procesoHTML = '';
        
        // Lógica de estados (Sin cambios)
        if (estadoId === 1) { // Pendiente
            procesoHTML = `
                <div class="proceso-view">
                    <div class="proceso-header">
                        <div class="proceso-step active"><span class="step-number">1</span><span class="step-title">Solicitud Enviada</span></div>
                        <div class="proceso-step"><span class="step-number">2</span><span class="step-title">Confirmación</span></div>
                        <div class="proceso-step"><span class="step-number">3</span><span class="step-title">Taller Realizado</span></div>
                    </div>
                    <div class="proceso-content">
                        <h5>Estado: <span class="status-badge status-pendiente">Pendiente de Revisión</span></h5>
                        <p><strong>Hemos recibido tu solicitud y está en proceso de revisión.</strong></p>
                    </div>
                </div>`;
        } else if (estadoId === 2) { // Aceptado
            procesoHTML = `
                <div class="proceso-view">
                    <div class="proceso-header">
                        <div class="proceso-step completed"><span class="step-number">✔</span><span class="step-title">Solicitud Enviada</span></div>
                        <div class="proceso-step active"><span class="step-number">2</span><span class="step-title">Confirmación</span></div>
                        <div class="proceso-step"><span class="step-number">3</span><span class="step-title">Taller Realizado</span></div>
                    </div>
                    <div class="proceso-content">
                        <h5>Estado: <span class="status-badge status-confirmado-en-espera">Confirmado - En Espera de Pago</span></h5>
                        <p><strong>Tu solicitud ha sido aprobada.</strong></p>
                        <p>Por favor realiza el pago y sube el comprobante.</p>
                        <div class="info-box"><p><strong>Cuenta a transferir:</strong> ${solicitud.cuentaTransferir || '123-456-7890 BANCO'}</p></div>
                        <input type="file" id="file-input-${solicitud.idSolicitudTaller}" class="hidden" accept="image/*">
                        <button class="btn-action-box" data-for-input="file-input-${solicitud.idSolicitudTaller}">📷 Subir Comprobante</button>
                        <div class="image-preview-container hidden"><img class="image-preview" src="" alt="Vista previa"></div>
                        <button class="btn btn-update hidden" data-id="${solicitud.idSolicitudTaller}" data-new-state="4">Confirmar Pago</button>
                    </div>
                </div>`;
        } else  if (estadoId === 4) { // Completado
            procesoHTML = `
                <div class="proceso-view">
                    <div class="proceso-header">
                        <div class="proceso-step completed"><span class="step-number">✔</span><span class="step-title">Solicitud Enviada</span></div>
                        <div class="proceso-step completed"><span class="step-number">✔</span><span class="step-title">Confirmación</span></div>
                        <div class="proceso-step completed"><span class="step-number">✔</span><span class="step-title">Taller Realizado</span></div>
                    </div>
                    <div class="proceso-content">
                        <h5>Estado: <span class="status-badge status-completado">Taller Completado</span></h5>
                        <p><strong>¡Este taller ha sido completado con éxito!</strong></p>
                        ${solicitud.estadoPagoImagen ? `<button class="btn-action-box" data-action="view-comprobante" data-url="${solicitud.estadoPagoImagen}">📄 Ver Comprobante</button>` : ''}
                    </div>
                </div>`;
        }
        
        detailView.innerHTML = `
            <button class="btn" id="backToListBtn">← Volver a la lista</button>
            <div class="detail-card">
                <div class="detail-column">
                    <div class="info-group"><label>Taller:</label><p>${nombreTaller}</p></div>
                    <div class="info-group"><label>Ubicación:</label><p><img src="/Imagenes/location.png" class="icon"> ${solicitud.direccion}</p></div>
                    <div class="info-group"><label>Fecha de Inicio:</label><p>${solicitud.fechaAplicarTaller}</p></div>
                    <div class="info-group"><label>Fecha de Final:</label><p>${fechaFinalFormateada}</p></div>
                </div>
                <div class="vertical-divider"></div>
                <div class="detail-column detail-actions">
                    ${procesoHTML}
                </div>
            </div>`;
    }
    
    async function renderHistorialView() {
        historialCardsContainer.innerHTML = '<p>Cargando historial...</p>';
        const allSolicitudes = await getAllSolicitudes();
        
        // Filtrar solo estados 3 (Rechazado) y 5 (Completado)
        const historialItems = allSolicitudes.filter(s => s.idEstado === 3 || s.idEstado === 5);

        if (historialItems.length === 0) {
            historialCardsContainer.innerHTML = '<p>No hay talleres completados o rechazados en tu historial.</p>';
            return;
        }

        historialCardsContainer.innerHTML = ''; // Limpiar "Cargando..."
        historialItems.forEach(item => {
            const fechaInicio = new Date(item.fechaAplicarTaller + 'T00:00:00');
            const fechaFinal = item.fechaFin ? new Date(item.fechaFin + 'T00:00:00') : new Date(fechaInicio);
            if (!item.fechaFin) {
                fechaFinal.setDate(fechaInicio.getDate() + 7);
            }
            
            const nombreTaller = getTallerName(item.idTaller);
            
            // Definir estado y color
            let estadoDisplay = '';
            let estadoColor = '';
            if (item.idEstado === 3) {
                estadoDisplay = 'Rechazado';
                estadoColor = '#F44336'; // Rojo
            } else if (item.idEstado === 5) {
                estadoDisplay = 'Completado';
                estadoColor = '#4CAF50'; // Verde
            }
            
            const card = `
                <div class="historial-card" data-id="${item.idSolicitudTaller}">
                    <div class="historial-card-body">
                        <p><strong>Taller:</strong> ${nombreTaller}</p>
                        <p><img src="/Imagenes/user.png" class="icon"> <strong>Impartió:</strong> ${item.impartio || 'No asignado'}</p>
                        <p><img src="/Imagenes/location.png" class="icon"> <strong>Ubicación:</strong> ${item.direccion}</p>
                        <div class="expandable-content">
                            <div class="info-group"><p><strong>Fecha de Inicio:</strong> ${item.fechaAplicarTaller}</p></div>
                            <div class="info-group"><p><strong>Fecha de Final:</strong> ${fechaFinal.toISOString().split('T')[0]}</p></div>
                            ${item.estadoPagoImagen ? `<a href="#" class="btn-ver-comprobante" data-url="${item.estadoPagoImagen}"><img src="/Imagenes/eye-icon.png" class="icon"> Ver comprobante</a>` : ''}
                        </div>
                    </div>
                    <a href="#" class="toggle-details">▼ Ver más</a>
                    <div class="historial-card-footer">
                        <button class="btn btn-status" style="background-color: ${estadoColor}; border-color: ${estadoColor};">${estadoDisplay}</button>
                    </div>
                </div>`;
            historialCardsContainer.innerHTML += card;
        });
    }

    // --- MANEJO DE VISTAS Y EVENTOS (Sin cambios) ---
    function showMainView(viewName) {
        detailView.classList.add('hidden'); 
        listView.classList.remove('hidden');

        if (viewName === 'solicitudes') {
            solicitudesView.classList.remove('hidden');
            historialView.classList.add('hidden');
            renderSolicitudesListView(); 
        } else {
            solicitudesView.classList.add('hidden');
            historialView.classList.remove('hidden');
            renderHistorialView();
        }
    }

    document.querySelector('.filter-buttons').addEventListener('click', (e) => {
        if (e.target.matches('.btn-filter')) {
            document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            showMainView(e.target.dataset.view);
        }
    });

    document.querySelector('.main-content').addEventListener('click', async (e) => {
        const detailsButton = e.target.closest('.btn-details');
        const backButton = e.target.closest('#backToListBtn');
        const actionBoxButton = e.target.closest('.btn-action-box[data-for-input]');
        const viewComprobanteButton = e.target.closest('.btn-action-box[data-action="view-comprobante"]') || e.target.closest('.btn-ver-comprobante');
        const updateButton = e.target.closest('.btn-update');

        if (detailsButton) { 
            renderDetailView(detailsButton.dataset.id); 
        }
        if (backButton) { 
            detailView.classList.add('hidden');
            const activeFilter = document.querySelector('.btn-filter.active');
            showMainView(activeFilter ? activeFilter.dataset.view : 'solicitudes'); 
        }
        if (actionBoxButton) { 
            document.getElementById(actionBoxButton.dataset.forInput).click(); 
        }
        if (viewComprobanteButton) {
            e.preventDefault();
            const url = viewComprobanteButton.dataset.url;
            comprobanteImage.src = url;
            viewComprobanteModal.classList.remove('hidden');
        }
        
        if (updateButton) {
            const solicitudId = updateButton.dataset.id;
            const nuevoEstado = updateButton.dataset.newState; // '4'
            
            const previewImage = detailView.querySelector('.image-preview');
            const comprobanteURL = previewImage ? previewImage.src : null;
            
            if (!comprobanteURL || !comprobanteURL.startsWith('data:')) {
                alert('Por favor, sube primero el comprobante de pago.');
                return;
            }

            // Aquí se debería subir la imagen 'comprobanteURL' (en Base64) a un servidor
            // y obtener una URL real. El backend en 'estadoPagoImagen' espera una URL (String).
            //
            // Por ahora, solo actualizamos el estado.
            
            const isUpdated = await updateSolicitudEstado(solicitudId, nuevoEstado);

            if (isUpdated) {
                alert('¡Pago confirmado! Tu taller ha sido marcado como completado.');
                detailView.classList.add('hidden');
                listView.classList.remove('hidden');
                renderSolicitudesListView();
            }
        }
    });
    
    detailView.addEventListener('change', (e) => {
        if (e.target.matches('input[type="file"]')) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const previewContainer = e.target.nextElementSibling.nextElementSibling;
                    const previewImage = previewContainer.querySelector('.image-preview');
                    const updateButton = previewContainer.nextElementSibling;
                    
                    previewImage.src = event.target.result;
                    previewContainer.classList.remove('hidden');
                    updateButton.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        }
    });

    historialCardsContainer.addEventListener('click', (e) => {
        e.preventDefault();
        const toggleLink = e.target.closest('.toggle-details');
        if (toggleLink) {
            const card = toggleLink.closest('.historial-card');
            const content = card.querySelector('.expandable-content');
            content.classList.toggle('expanded');
            toggleLink.innerHTML = content.classList.contains('expanded') ? '▲ Ver menos' : '▼ Ver más';
        }
    });

    closeComprobanteModal.addEventListener('click', () => {
        viewComprobanteModal.classList.add('hidden');
    });

    // --- INICIALIZACIÓN ---
    async function initialize() {
        await fetchUserProfile(); // Carga el nombre de usuario
        await fetchCatalogos(); // Carga los nombres de los talleres
        showMainView('solicitudes'); // Muestra la vista inicial
    }
    
    initialize();
});