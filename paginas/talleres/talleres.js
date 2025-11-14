document.addEventListener('DOMContentLoaded', async () => {
    // --- URL DEL SERVIDOR y AUTENTICACIÓN ---
    const API_BASE_URL = 'http://localhost:7000';
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual')); 

    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        console.error("Acceso denegado o sesión inválida. Redirigiendo a login.");
        localStorage.clear();
        window.location.href = '../../index.html';
        return;
    }
    
    const authToken = authInfo.token;
    
    // --- Mapeo de Estados ---
    // Estado 1 = Pendiente (no se muestra)
    // Estado 2 = Aceptada (se muestra en el historial)
    // Estado 3 = Rechazado (se muestra en la sección de rechazados)
    // Estado 4 = Revisión (se muestra en la sección de revisión)
    // Estado 5 = Completado (se muestra en la sección de completado)
    const ESTADO_MAP = {
        'all': 0, // Filtro especial
        'aceptada': 2,      // Aceptada
        'rechazado': 3,     // Rechazado
        'revision': 4,      // Revisión
        'completado': 5,    // Completado
    };

    // --- ELEMENTOS DEL DOM ---
    const workshopListContainer = document.getElementById('workshop-list');
    const historyGridContainer = document.getElementById('workshop-history-grid');
    const modal = document.getElementById('workshopModal');
    const deleteModal = document.getElementById('deleteConfirmationModal');
    const successModal = document.getElementById('successModal');
    const receiptModal = document.getElementById('receiptModal');
    const workshopForm = document.getElementById('workshopForm');
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    let editingWorkshopId = null;
    let catalogoTalleres = []; // Almacenará los talleres disponibles

    // --- FUNCIONES HELPER (API) ---

    async function fetchWithAuth(url, options = {}) {
        const headers = {
            'Authorization': `Bearer ${authToken}`,
            ...(options.headers || {})
        };
        const finalOptions = { ...options, headers };
        return await fetch(url, finalOptions);
    }
    
    const openModal = (m) => m.classList.remove('hidden');
    const closeModal = (m) => m.classList.add('hidden');
    const showSuccess = (message = "Cambios guardados") => { 
        successModal.querySelector('h2').textContent = message;
        openModal(successModal); 
        setTimeout(() => closeModal(successModal), 2000); 
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


    // --- 1. GESTIÓN DE TALLERES DISPONIBLES (CRUD) ---

    /**
     * Carga los talleres disponibles (Catálogo)
     */
    async function fetchTalleresDisponibles() {
        workshopListContainer.innerHTML = '<p class="loading-message">Cargando catálogo de talleres...</p>';
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/talleres/`, { method: 'GET' });
            if (!response.ok) throw new Error("Error al cargar talleres.");
            
            catalogoTalleres = await response.json();
            renderTalleresDisponibles();

        } catch (error) {
            console.error('Error fetching talleres disponibles:', error);
            workshopListContainer.innerHTML = `<p class="error-message">Error de conexión con el servidor. (${error.message})</p>`;
        }
    }

    const renderTalleresDisponibles = () => {
        workshopListContainer.innerHTML = '';
        if (catalogoTalleres.length === 0) {
            workshopListContainer.innerHTML = '<p>No hay talleres disponibles. ¡Agrega el primero!</p>';
            return;
        }
        
        catalogoTalleres.forEach(taller => {
            const item = document.createElement('div');
            item.className = 'workshop-item';
            
            // Usamos el campo nombreEstadoVisual que calcula Taller.java
            const estadoVisual = taller.nombreEstadoVisual || (taller.idEstado === 4 ? 'Completado' : (taller.idEstado === 1 || taller.idEstado === 5 ? 'Próximo' : 'En curso'));
            
            item.innerHTML = `
                <div class="workshop-header">
                    <h5>${taller.nombreTaller}</h5>
                    <button class="btn btn-secondary btn-edit" data-id="${taller.idTaller}">Editar</button>
                </div>
                <p class="workshop-description">${taller.descripcion}</p>
                <p class="workshop-cost">Costo: $${taller.costo ? taller.costo.toLocaleString() : '0'}</p>
                <p class="workshop-status status-${estadoVisual.toLowerCase().replace(/ /g, '-')}" title="Estado en el catálogo">${estadoVisual}</p>
            `;
            workshopListContainer.appendChild(item);
        });
    };

    // --- Lógica del Modal (CRUD) ---

    const openModalForEdit = (id) => {
        editingWorkshopId = id;
        const taller = catalogoTalleres.find(t => t.idTaller === id);
        if (!taller) return;
        modal.querySelector('#modalTitle').textContent = 'Editar Taller';
        workshopForm.elements['workshopName'].value = taller.nombreTaller;
        workshopForm.elements['workshopDescription'].value = taller.descripcion;
        workshopForm.elements['workshopCost'].value = taller.costo;
        document.getElementById('deleteWorkshopBtn').classList.remove('hidden');
        openModal(modal);
    };
    
    const openModalForNew = () => {
        editingWorkshopId = null;
        modal.querySelector('#modalTitle').textContent = 'Agregar Nuevo Taller';
        workshopForm.reset();
        document.getElementById('deleteWorkshopBtn').classList.add('hidden');
        openModal(modal);
    };

    workshopForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nombreTaller = workshopForm.elements['workshopName'].value.trim();
        const descripcion = workshopForm.elements['workshopDescription'].value.trim();
        const costo = parseFloat(workshopForm.elements['workshopCost'].value);
        
        const payload = {
            nombreTaller,
            descripcion,
            costo,
            idEstado: 1, // Por defecto, se crea como 'Próximo' o 'Pendiente'
        };

        const method = editingWorkshopId ? 'PUT' : 'POST';
        const url = editingWorkshopId ? `${API_BASE_URL}/talleres/${editingWorkshopId}` : `${API_BASE_URL}/talleres/`;
        
        try {
            const response = await fetchWithAuth(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error en API: ${errorText}`);
            }

            // Éxito:
            await fetchTalleresDisponibles(); // Recargar la lista
            closeModal(modal);
            showSuccess(editingWorkshopId ? "Taller actualizado" : "Taller agregado con éxito");
            
        } catch (error) {
            console.error(`Error ${method} taller:`, error);
            alert(`Error al guardar: ${error.message}`);
        }
    });

    document.getElementById('acceptDelete').addEventListener('click', async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/talleres/${editingWorkshopId}`, { method: 'DELETE' });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error en API: ${errorText}`);
            }

            await fetchTalleresDisponibles();
            closeModal(deleteModal);
            showSuccess("Taller eliminado");

        } catch (error) {
            console.error('Error DELETE taller:', error);
            alert(`Error al eliminar: ${error.message}`);
            closeModal(deleteModal);
        }
    });


    // --- 2. HISTORIAL DE TALLERES (SOLICITUDES) ---

    /**
     * Carga el historial de solicitudes de talleres para el agrónomo.
     * El Agrónomo ve TODAS las solicitudes según el filtro seleccionado.
     */
    async function fetchHistorialTalleres(filterEstadoId = 0) {
        historyGridContainer.innerHTML = '<p class="loading-message">Cargando historial de solicitudes...</p>';
        
        try {
            let url;
            
            if (filterEstadoId === 0) {
                // Cargar todos
                url = `${API_BASE_URL}/solicitudtaller`;
            } else {
                // Filtrar por estado específico
                url = `${API_BASE_URL}/getTallerForStatus/${filterEstadoId}`;
            }

            const response = await fetchWithAuth(url, { method: 'GET' });
            if (!response.ok) throw new Error("Error al cargar historial.");

            const historialData = await response.json();
            renderHistorialTalleres(historialData, filterEstadoId);

        } catch (error) {
            console.error('Error fetching historial:', error);
            historyGridContainer.innerHTML = `<p class="error-message">Error de conexión o permisos. (${error.message})</p>`;
        }
    }

    const renderHistorialTalleres = (historial, filter) => {
        historyGridContainer.innerHTML = '';
        
        if (historial.length === 0) {
            historyGridContainer.innerHTML = '<p>No hay solicitudes de talleres que coincidan con el filtro seleccionado.</p>';
            return;
        }

        historial.forEach(taller => {
            // Mapear idEstado a etiqueta de estado
            let estadoDisplay = '';
            let estadoKey = '';
            
            switch(taller.idEstado) {
                case 2:
                    estadoDisplay = 'Aceptada';
                    estadoKey = 'aceptada';
                    break;
                case 3:
                    estadoDisplay = 'Rechazado';
                    estadoKey = 'rechazado';
                    break;
                case 4:
                    estadoDisplay = 'En Revisión';
                    estadoKey = 'revision';
                    break;
                case 5:
                    estadoDisplay = 'Completado';
                    estadoKey = 'completado';
                    break;
                default:
                    estadoDisplay = 'Pendiente';
                    estadoKey = 'pendiente';
            }
            
            const card = document.createElement('div');
            card.className = 'history-card';
            
            // Obtener el nombre del taller del catálogo
            const nombreTaller = catalogoTalleres.find(c => c.idTaller === taller.idTaller)?.nombreTaller || `Taller ID: ${taller.idTaller}`;

            card.innerHTML = `
                <div class="history-card-body">
                    <p><strong>Taller:</strong> ${nombreTaller}</p>
                    <p><img src="/Imagenes/user.png" class="icon"> <strong>Agricultor ID:</strong> ${taller.idAgricultor}</p>
                    <p><img src="/Imagenes/marker.png" class="icon"> <strong>Dirección:</strong> ${taller.direccion}</p>
                    <div class="expandable-content">
                        <div class="info-group"><p><strong>Fecha Solicitud:</strong> ${taller.fechaSolicitud.split('T')[0]}</p></div>
                        <div class="info-group"><p><strong>Fecha Aplicación:</strong> ${taller.fechaAplicarTaller}</p></div>
                        <div class="info-group"><p><strong>Comentario:</strong> ${taller.comentario || 'N/A'}</p></div>
                        ${taller.estadoPagoImagen ? `<a href="#" class="view-receipt" data-img-src="${taller.estadoPagoImagen}"><img src="/Imagenes/eye-icon.png" class="icon"> Ver comprobante</a>` : ''}
                    </div>
                </div>
                <div class="history-card-footer">
                    <a href="#" class="toggle-details-btn">▼ Ver más</a>
                    <div class="footer-actions">
                        <button class="btn btn-status status-${estadoKey}" disabled>${estadoDisplay}</button>
                        ${taller.idEstado === 4 ? `<button class="btn  btn-complete btn-comp" data-solicitud-id="${taller.idSolicitudTaller}">Marcar como Completado</button>` : ''}
                    </div>
                </div>`;
            historyGridContainer.appendChild(card);
        });
    };
    
    // --- MANEJO DE EVENTOS (Delegación) ---
    
    // 1. Alternar vistas y cargar datos
    document.querySelector('.workshops-nav').addEventListener('click', (e) => {
        if (e.target.matches('.nav-button')) {
            document.querySelectorAll('.workshops-nav .nav-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            const view = e.target.dataset.view;
            document.getElementById('view-capacitaciones').classList.toggle('hidden', view !== 'capacitaciones');
            document.getElementById('view-historial').classList.toggle('hidden', view !== 'historial');
            
            if (view === 'historial') {
                // Forzar carga de historial al cambiar a la vista
                document.querySelector('.filter-buttons .filter-btn[data-filter="all"]').click();
            } else {
                fetchTalleresDisponibles();
            }
        }
    });

    // 2. Filtro de historial
    document.querySelector('.filter-buttons').addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            document.querySelectorAll('.filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            const filterKey = e.target.dataset.filter;
            const estadoId = filterKey === 'all' ? 0 : (ESTADO_MAP[filterKey] || 0);
            fetchHistorialTalleres(estadoId);
        }
    });

    // 3. Edición de catálogo
    workshopListContainer.addEventListener('click', (e) => {
        const editButton = e.target.closest('.btn-edit');
        if (editButton) openModalForEdit(parseInt(editButton.dataset.id));
    });

    // 4. Botones de Modal
    document.getElementById('addNewWorkshopBtn').addEventListener('click', openModalForNew);
    document.getElementById('cancelWorkshop').addEventListener('click', () => closeModal(modal));
    document.getElementById('saveWorkshop').addEventListener('click', () => workshopForm.requestSubmit());
    document.getElementById('deleteWorkshopBtn').addEventListener('click', () => { closeModal(modal); openModal(deleteModal); });
    document.getElementById('cancelDelete').addEventListener('click', () => closeModal(deleteModal));
    document.getElementById('closeReceipt').addEventListener('click', () => closeModal(receiptModal));

    // 5. Ver más / Comprobante (Historial)
    historyGridContainer.addEventListener('click', async (e) => {
        const toggleLink = e.target.closest('.toggle-details-btn');
        const receiptLink = e.target.closest('.view-receipt');
        const completeButton = e.target.closest('.btn-complete');

        if (toggleLink) {
            e.preventDefault();
            const content = toggleLink.closest('.history-card').querySelector('.expandable-content');
            content.classList.toggle('expanded');
            toggleLink.innerHTML = content.classList.contains('expanded') ? '▲ Ver menos' : '▼ Ver más';
        }

        if (receiptLink) {
            e.preventDefault();
            document.getElementById('receiptImage').src = receiptLink.dataset.imgSrc;
            openModal(receiptModal);
        }

        if (completeButton) {
            e.preventDefault();
            const solicitudId = completeButton.dataset.solicitudId;
            
            if (confirm('¿Deseas marcar este taller como completado?')) {
                try {
                    const response = await fetchWithAuth(`${API_BASE_URL}/solicitudtaller/${solicitudId}/5`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idEstado: 5 })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Error: ${errorText}`);
                    }

                    showSuccess('Taller marcado como completado');
                    const estadoId = ESTADO_MAP['revision'];
                    fetchHistorialTalleres(estadoId);
                } catch (error) {
                    console.error('Error al marcar como completado:', error);
                    alert(`Error al marcar como completado: ${error.message}`);
                }
            }
        }
    });
    
    // --- INICIALIZACIÓN ---
    await loadProfileAndGreeting(); // Saludo dinámico
    await fetchTalleresDisponibles(); // Cargar catálogo al inicio
});