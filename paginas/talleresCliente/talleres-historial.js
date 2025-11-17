document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE_URL = "http://localhost:7000";
    const authString = localStorage.getItem('usuarioActual');
    const usuarioActual = authString ? JSON.parse(authString) : null;

    if (!usuarioActual || !usuarioActual.id || !usuarioActual.token) { 
        window.location.href = '/index.html'; 
        return; 
    }
    
    const authToken = usuarioActual.token;
    const userId = usuarioActual.id;
    let catalogoTalleres = [];

    const listView = document.getElementById('talleres-list-view');
    const detailView = document.getElementById('detail-view');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const viewComprobanteModal = document.getElementById('viewComprobanteModal');
    const comprobanteImage = document.getElementById('comprobanteImage');
    const closeComprobanteModal = document.getElementById('closeComprobanteModal');

    async function fetchWithToken(url, options = {}) {
        const headers = { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', ...options.headers };
        const response = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });
        if (!response.ok) {
            if (response.status === 401) window.location.href = '/index.html';
            throw new Error(`API Error: ${response.status}`);
        }
        const type = response.headers.get("content-type");
        return (type && type.includes("json")) ? response.json() : response.text();
    }

    async function fetchUserProfile() {
        try {
            const profile = await fetchWithToken(`/perfil/${userId}`);
            welcomeMessage.textContent = `Bienvenido, ${profile.nombre}`;
        } catch (e) {}
    }

    async function fetchCatalogos() {
        try { catalogoTalleres = await fetchWithToken(`/talleres`); } catch (e) {}
    }

    function getTallerName(id) {
        const t = catalogoTalleres.find(x => x.idTaller === id);
        return t ? t.nombreTaller : `Taller ${id}`;
    }

    // --- LÓGICA DE FILTRADO ---
    async function fetchAndRenderTalleres(filtro = 'todos') {
        listView.innerHTML = '<p>Cargando talleres...</p>';
        try {
            const todas = await fetchWithToken(`/solicitudtaller/misolicitudes`);
            
            // Aplicar los filtros solicitados
            const filtradas = todas.filter(s => {
                if (filtro === 'todos') return true;
                if (filtro === 'completados') return s.idEstado === 5;
                if (filtro === 'en-curso') return s.idEstado === 2 || s.idEstado === 4;
                if (filtro === 'proximo') return s.idEstado === 1;
                return false;
            });

            if (filtradas.length === 0) {
                listView.innerHTML = '<p>No se encontraron talleres en esta categoría.</p>';
                return;
            }

            listView.innerHTML = '';
            filtradas.forEach(s => {
                const nombre = getTallerName(s.idTaller);
                // Mostrar el nombre del agrónomo o un valor por defecto
                const impartioDisplay = s.nombreAgronomo || s.impartio || 'Agrónomo Encargado';
                let estadoTexto = 'Desconocido';
                let estadoColor = '#ccc';

                switch(s.idEstado) {
                    case 1: estadoTexto = 'Próximo (Pendiente)'; estadoColor = '#FFC107'; break;
                    case 2: estadoTexto = 'En Curso (Aceptada)'; estadoColor = '#2196F3'; break;
                    case 3: estadoTexto = 'Rechazada'; estadoColor = '#F44336'; break;
                    case 4: estadoTexto = 'En Revisión'; estadoColor = '#17A2B8'; break;
                    case 5: estadoTexto = 'Completado'; estadoColor = '#4CAF50'; break;
                }

                const card = `
                    <div class="historial-card">
                        <div class="historial-card-body">
                            <h5>${nombre}</h5>
                            <p><img src="/Imagenes/user.png" class="icon"> <strong>Impartió:</strong> ${impartioDisplay}</p>
                            <p><img src="/Imagenes/location.png" class="icon"> ${s.direccion}</p>
                            <p><img src="/Imagenes/calendar.png" class="icon"> ${s.fechaAplicarTaller}</p>
                            <div class="expandable-content">
                                <p><strong>Comentario:</strong> ${s.comentario || 'N/A'}</p>
                                ${s.estadoPagoImagen ? `<a href="#" class="view-receipt" data-url="${s.estadoPagoImagen}">Ver comprobante</a>` : ''}
                            </div>
                        </div>
                        <div class="historial-card-footer" style="display:flex; justify-content:space-between; align-items:center; padding:10px 20px;">
                             <button class="btn btn-details btn-sm" data-id="${s.idSolicitudTaller}">Ver Detalles</button>
                             <span class="status-badge" style="background:${estadoColor}; color:white; padding:5px 10px; border-radius:15px; font-size:12px;">${estadoTexto}</span>
                        </div>
                    </div>`;
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = card;
                listView.appendChild(tempDiv.firstElementChild);
            });

        } catch (error) {
            listView.innerHTML = `<p class="error-message">Error: ${error.message}</p>`;
        }
    }

    // --- VISTA DETALLE ---
    async function renderDetailView(id) {
        const todas = await fetchWithToken(`/solicitudtaller/misolicitudes`);
        const s = todas.find(x => x.idSolicitudTaller == id);
        if (!s) return;

        listView.classList.add('hidden');
        detailView.classList.remove('hidden');

        let actionHTML = '';
        // Lógica de visualización de acciones según estado
        if (s.idEstado === 2) { 
            actionHTML = `
                <div class="info-box"><p>Cuenta: 1234-5678-9012</p></div>
                <input type="file" id="file-input-${s.idSolicitudTaller}" class="hidden" accept="image/*">
                <button class="btn-action-box" data-for-input="file-input-${s.idSolicitudTaller}">📷 Subir Comprobante</button>
                <div class="image-preview-container hidden"><img class="image-preview" src=""></div>
                <button class="btn btn-update hidden" data-id="${s.idSolicitudTaller}">Confirmar Pago</button>
            `;
        } else if (s.idEstado === 4) {
             actionHTML = `<p><em>Pago enviado. Esperando validación del agrónomo.</em></p>`;
        } else if (s.idEstado === 5) {
             actionHTML = `<p><strong>¡Taller Completado!</strong></p>`;
        }

        detailView.innerHTML = `
            <button class="btn" id="backToListBtn" style="margin-bottom:20px;">← Volver</button>
            <div class="detail-card">
                <h3>${getTallerName(s.idTaller)}</h3>
                <p>Estado actual: <strong>${s.idEstado === 5 ? 'Completado' : (s.idEstado === 1 ? 'Pendiente' : 'En Proceso')}</strong></p>
                <p>Ubicación: ${s.direccion}</p>
                ${actionHTML}
            </div>
        `;
    }

    // --- EVENTOS ---
    document.querySelector('.filter-buttons').addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            fetchAndRenderTalleres(e.target.dataset.filter);
        }
    });

    document.querySelector('.main-content').addEventListener('click', async (e) => {
        if (e.target.matches('.btn-details')) renderDetailView(e.target.dataset.id);
        
        if (e.target.id === 'backToListBtn') {
            detailView.classList.add('hidden');
            listView.classList.remove('hidden');
        }
        
        if (e.target.closest('.btn-action-box')) {
            document.getElementById(e.target.closest('.btn-action-box').dataset.forInput).click();
        }
        
        if (e.target.matches('.btn-update')) {
             const id = e.target.dataset.id;
             // Lógica de subir pago
             await fetchWithToken(`/solicitudtaller/${id}/4`, { method: 'PATCH' });
             alert('Pago enviado a revisión.');
             detailView.classList.add('hidden');
             listView.classList.remove('hidden');
             // Refrescar y mostrar filtro 'En Curso'
             document.querySelector('.filter-buttons .filter-btn[data-filter="en-curso"]').click();
        }
        
        if (e.target.matches('.view-receipt')) {
            e.preventDefault();
            comprobanteImage.src = e.target.dataset.url;
            viewComprobanteModal.classList.remove('hidden');
        }
    });

    detailView.addEventListener('change', (e) => {
        if (e.target.matches('input[type="file"]')) {
             const reader = new FileReader();
             reader.onload = (ev) => {
                 const container = e.target.nextElementSibling.nextElementSibling;
                 container.querySelector('img').src = ev.target.result;
                 container.classList.remove('hidden');
                 container.nextElementSibling.classList.remove('hidden'); 
             };
             reader.readAsDataURL(e.target.files[0]);
        }
    });

    closeComprobanteModal.addEventListener('click', () => viewComprobanteModal.classList.add('hidden'));

    // --- INICIO ---
    await fetchUserProfile();
    await fetchCatalogos();
    await fetchAndRenderTalleres('todos');
});