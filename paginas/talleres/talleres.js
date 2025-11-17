document.addEventListener('DOMContentLoaded', async () => {
    // --- CONFIGURACIÓN ---
    const API_BASE_URL = 'http://localhost:7000';
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual')); 

    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        localStorage.clear();
        window.location.href = '../../index.html';
        return;
    }
    const authToken = authInfo.token;
    
    // --- ELEMENTOS ---
    const workshopListContainer = document.getElementById('workshop-list');
    const historyGridContainer = document.getElementById('workshop-history-grid');
    const modal = document.getElementById('workshopModal');
    const deleteModal = document.getElementById('deleteConfirmationModal');
    const successModal = document.getElementById('successModal');
    const receiptModal = document.getElementById('receiptModal');
    const workshopForm = document.getElementById('workshopForm');
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    let editingWorkshopId = null;
    let catalogoTalleres = []; 

    // --- HELPERS ---
    async function fetchWithAuth(url, options = {}) {
        const headers = { 'Authorization': `Bearer ${authToken}`, ...(options.headers || {}) };
        return await fetch(url, { ...options, headers });
    }
    const openModal = (m) => m.classList.remove('hidden');
    const closeModal = (m) => m.classList.add('hidden');
    const showSuccess = (msg) => { 
        successModal.querySelector('h2').textContent = msg; 
        openModal(successModal); 
        setTimeout(() => closeModal(successModal), 2000); 
    };

    async function loadProfileAndGreeting() {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });
            if (response.ok) {
                const user = await response.json();
                if(welcomeMessage) welcomeMessage.textContent = `Bienvenido, ${user.nombre}`;
            }
        } catch (e) {}
    }

    // --- 1. CATÁLOGO (Sin cambios) ---
    async function fetchTalleresDisponibles() {
        workshopListContainer.innerHTML = '<p>Cargando catálogo...</p>';
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/talleres/`, { method: 'GET' });
            if (res.ok) {
                catalogoTalleres = await res.json();
                renderTalleresDisponibles();
            }
        } catch (e) { workshopListContainer.innerHTML = `<p>Error: ${e.message}</p>`; }
    }

    const renderTalleresDisponibles = () => {
        workshopListContainer.innerHTML = '';
        if (catalogoTalleres.length === 0) {
            workshopListContainer.innerHTML = '<p>No hay talleres disponibles.</p>';
            return;
        }
        catalogoTalleres.forEach(t => {
            const item = document.createElement('div');
            item.className = 'workshop-item';
            const estadoVisual = t.idEstado === 4 ? 'Completado' : 'Disponible'; 
            item.innerHTML = `
                <div class="workshop-header">
                    <h5>${t.nombreTaller}</h5>
                    <button class="btn btn-secondary btn-edit" data-id="${t.idTaller}">Editar</button>
                </div>
                <p class="workshop-description">${t.descripcion}</p>
                <p class="workshop-cost">Costo: $${t.costo.toLocaleString()}</p>
                <p class="workshop-status status-${estadoVisual.toLowerCase()}">${estadoVisual}</p>
            `;
            workshopListContainer.appendChild(item);
        });
    };

    // --- 2. HISTORIAL (CON FILTROS CORREGIDOS) ---
    async function fetchHistorialTalleres(filtro = 'todos') {
        historyGridContainer.innerHTML = '<p>Cargando historial...</p>';
        try {
            // ★ SIEMPRE TRAEMOS TODO PARA PODER FILTRAR EN EL CLIENTE ★
            const url = `${API_BASE_URL}/solicitudtaller`;
            const response = await fetchWithAuth(url, { method: 'GET' });
            if (!response.ok) throw new Error("Error al cargar historial.");

            const allData = await response.json();
            renderHistorialTalleres(allData, filtro);

        } catch (error) {
            historyGridContainer.innerHTML = `<p>Error: ${error.message}</p>`;
        }
    }

    const renderHistorialTalleres = (historial, filtro) => {
        historyGridContainer.innerHTML = '';
        
        // ★ FILTRADO INTELIGENTE ★
        const filtered = historial.filter(t => {
            // Estados: 1=Pendiente, 2=Aceptada, 3=Rechazada, 4=Revisión, 5=Completado
            if (filtro === 'todos') return true;
            if (filtro === 'completados') return t.idEstado === 5;
            // "En Curso" agrupa Aceptada (2) y Revisión (4)
            if (filtro === 'en-curso') return t.idEstado === 2 || t.idEstado === 4;
            // "Próximo" agrupa Pendiente (1)
            if (filtro === 'proximo') return t.idEstado === 1;
            return false;
        });

        if (filtered.length === 0) {
            historyGridContainer.innerHTML = '<p>No hay solicitudes en esta categoría.</p>';
            return;
        }

        filtered.forEach(taller => {
            let label = 'Desconocido';
            let claseColor = 'pendiente';

            switch(taller.idEstado) {
                case 1: label = 'Próximo (Pendiente)'; claseColor = 'pendiente'; break;
                case 2: label = 'En Curso (Aceptada)'; claseColor = 'en-curso'; break;
                case 4: label = 'En Curso (Revisión)'; claseColor = 'revision'; break;
                case 5: label = 'Completado'; claseColor = 'completado'; break;
                case 3: label = 'Rechazado'; claseColor = 'rechazado'; break;
            }
            
            const nombreTaller = catalogoTalleres.find(c => c.idTaller === taller.idTaller)?.nombreTaller || `Taller ${taller.idTaller}`;
            
            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-card-body">
                    <p><strong>Taller:</strong> ${nombreTaller}</p>
                    <p><img src="/Imagenes/user.png" class="icon"> <strong>Agricultor ID:</strong> ${taller.idAgricultor}</p>
                    <p><img src="/Imagenes/location.png" class="icon"> ${taller.direccion}</p>
                    <div class="expandable-content">
                        <div class="info-group"><p><strong>Fecha:</strong> ${taller.fechaAplicarTaller}</p></div>
                        <div class="info-group"><p><strong>Comentario:</strong> ${taller.comentario || 'N/A'}</p></div>
                        ${taller.estadoPagoImagen ? `<a href="#" class="view-receipt" data-img-src="${taller.estadoPagoImagen}">Ver comprobante</a>` : ''}
                    </div>
                </div>
                <div class="history-card-footer">
                    <a href="#" class="toggle-details-btn">▼ Ver más</a>
                    <div class="footer-actions">
                        <button class="btn btn-status status-${claseColor}" disabled>${label}</button>
                        ${taller.idEstado === 4 ? `<button class="btn btn-complete btn-comp" data-solicitud-id="${taller.idSolicitudTaller}">Marcar Completado</button>` : ''}
                    </div>
                </div>`;
            historyGridContainer.appendChild(card);
        });
    };

    // --- EVENTOS ---
    
    // Evento de Filtros (CORREGIDO)
    document.querySelector('.filter-buttons').addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            document.querySelectorAll('.filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            // Usamos el dataset.filter ('todos', 'completados', etc.) para llamar a la función
            fetchHistorialTalleres(e.target.dataset.filter);
        }
    });

    // Navegación
    document.querySelector('.workshops-nav').addEventListener('click', (e) => {
        if (e.target.matches('.nav-button')) {
            document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const view = e.target.dataset.view;
            document.getElementById('view-capacitaciones').classList.toggle('hidden', view !== 'capacitaciones');
            document.getElementById('view-historial').classList.toggle('hidden', view !== 'historial');
            
            if (view === 'historial') {
                // Resetea el filtro al entrar
                document.querySelector('.filter-buttons .filter-btn[data-filter="todos"]').click();
            } else {
                fetchTalleresDisponibles();
            }
        }
    });

    // --- (Resto de lógica de Modales y Eliminar igual que antes) ---
    workshopForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            nombreTaller: workshopForm.elements['workshopName'].value,
            descripcion: workshopForm.elements['workshopDescription'].value,
            costo: parseFloat(workshopForm.elements['workshopCost'].value),
            idEstado: 1
        };
        const method = editingWorkshopId ? 'PUT' : 'POST';
        const url = editingWorkshopId ? `${API_BASE_URL}/talleres/${editingWorkshopId}` : `${API_BASE_URL}/talleres/`;
        try {
            const res = await fetchWithAuth(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error(await res.text());
            await fetchTalleresDisponibles();
            closeModal(modal);
            showSuccess();
        } catch (err) { alert(err.message); }
    });

    workshopListContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-edit');
        if (btn) {
            editingWorkshopId = parseInt(btn.dataset.id);
            const t = catalogoTalleres.find(x => x.idTaller === editingWorkshopId);
            if (t) {
                workshopForm.elements['workshopName'].value = t.nombreTaller;
                workshopForm.elements['workshopDescription'].value = t.descripcion;
                workshopForm.elements['workshopCost'].value = t.costo;
                document.getElementById('modalTitle').textContent = 'Editar Taller';
                document.getElementById('deleteWorkshopBtn').classList.remove('hidden');
                openModal(modal);
            }
        }
    });
    
    document.getElementById('addNewWorkshopBtn').addEventListener('click', () => {
        editingWorkshopId = null;
        workshopForm.reset();
        document.getElementById('modalTitle').textContent = 'Agregar Nuevo Taller';
        document.getElementById('deleteWorkshopBtn').classList.add('hidden');
        openModal(modal);
    });
    
    document.getElementById('cancelWorkshop').addEventListener('click', () => closeModal(modal));
    document.getElementById('saveWorkshop').addEventListener('click', () => workshopForm.requestSubmit());
    document.getElementById('deleteWorkshopBtn').addEventListener('click', () => { closeModal(modal); openModal(deleteModal); });
    document.getElementById('cancelDelete').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('closeReceipt').addEventListener('click', () => closeModal(receiptModal));

    document.getElementById('acceptDelete').addEventListener('click', async () => {
        try {
            await fetchWithAuth(`${API_BASE_URL}/talleres/${editingWorkshopId}`, { method: 'DELETE' });
            await fetchTalleresDisponibles();
            closeModal(deleteModal);
            showSuccess("Eliminado");
        } catch (e) { alert(e.message); closeModal(deleteModal); }
    });

    // Acciones Historial (Expandir, Recibo, Completar)
    historyGridContainer.addEventListener('click', async (e) => {
        const toggle = e.target.closest('.toggle-details-btn');
        const receipt = e.target.closest('.view-receipt');
        const complete = e.target.closest('.btn-complete');

        if (toggle) {
            e.preventDefault();
            const content = toggle.closest('.history-card').querySelector('.expandable-content');
            content.classList.toggle('expanded');
            toggle.innerHTML = content.classList.contains('expanded') ? '▲ Ver menos' : '▼ Ver más';
        }
        if (receipt) {
            e.preventDefault();
            document.getElementById('receiptImage').src = receipt.dataset.imgSrc;
            openModal(receiptModal);
        }
        if (complete) {
            e.preventDefault();
            if (confirm('¿Marcar como completado?')) {
                try {
                    await fetchWithAuth(`${API_BASE_URL}/solicitudtaller/${complete.dataset.solicitudId}/5`, { 
                        method: 'PATCH' 
                    });
                    showSuccess('Completado');
                    const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
                    fetchHistorialTalleres(activeFilter);
                } catch (err) { alert(err.message); }
            }
        }
    });
    
    await loadProfileAndGreeting();
    await fetchTalleresDisponibles();
});