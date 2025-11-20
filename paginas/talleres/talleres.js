document.addEventListener('DOMContentLoaded', async () => {
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual'));
    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        localStorage.clear(); window.location.href = '../../index.html'; return;
    }
    const authToken = authInfo.token;
    
    const workshopListContainer = document.getElementById('workshop-list');
    const historyGridContainer = document.getElementById('workshop-history-grid');
    const modal = document.getElementById('workshopModal');
    const deleteModal = document.getElementById('deleteConfirmationModal');
    const successModal = document.getElementById('successModal');
    const workshopForm = document.getElementById('workshopForm');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const addNewWorkshopBtn = document.getElementById('addNewWorkshopBtn');
    const receiptModal = document.getElementById('receiptModal');
    const receiptImage = document.getElementById('receiptImage');
    const closeReceipt = document.getElementById('closeReceipt');
    
    let editingWorkshopId = null;
    let catalogoTalleres = []; 

    if(addNewWorkshopBtn) addNewWorkshopBtn.innerHTML = `<span>+</span> ${t('workshop.addNew')}`;

    const addDays = (date, days) => { const r = new Date(date); r.setDate(r.getDate() + days); return r; };
    async function fetchWithAuth(url, options = {}) {
        const headers = { 'Authorization': `Bearer ${authToken}`, ...(options.headers || {}) };
        return await fetch(url, { ...options, headers });
    }
    const openModalFunc = (m) => m.classList.remove('hidden');
    const closeModalFunc = (m) => m.classList.add('hidden');
    const showSuccess = () => { successModal.querySelector('h2').textContent = t('workshop.saved'); openModalFunc(successModal); setTimeout(() => closeModalFunc(successModal), 2000); };

    async function loadProfileAndGreeting() {
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });
            if (res.ok) { const u = await res.json(); if(welcomeMessage) welcomeMessage.textContent = `${t('greeting.welcome')}, ${u.nombre}`; }
        } catch (e) {}
    }

    // --- 1. CATÁLOGO ---
    async function fetchTalleresDisponibles() {
        workshopListContainer.innerHTML = `<p>${t('workshop.loading')}</p>`;
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/talleres/`, { method: 'GET' });
            if (res.ok) { catalogoTalleres = await res.json(); renderTalleresDisponibles(); }
        } catch (e) {}
    }

    const renderTalleresDisponibles = () => {
        workshopListContainer.innerHTML = '';
        catalogoTalleres.forEach(taller => {
            const div = document.createElement('div');
            div.className = 'workshop-item';
            div.innerHTML = `
                <div class="workshop-header">
                    <h5>${taller.nombreTaller}</h5>
                    <button class="btn btn-edit" data-id="${taller.idTaller}">${t('common.edit')}</button>
                </div>
                <p class="workshop-description">${taller.descripcion}</p>
                <p class="workshop-cost">${t('workshop.cost')} $${taller.costo.toLocaleString()}</p>
            `;
            workshopListContainer.appendChild(div);
        });
    };

    // --- 2. HISTORIAL ---
    function getVisualState(taller) {
        switch (taller.idEstado){
            case 5:
                return { status: 'completado', label: 'Completado' };
                break;
            case 1:
                return { status: 'proximo', label: 'Próximo' };
                break;
            case 2:
                return { status: 'en-curso', label: 'En curso' };
                break;
            case 3:
                return { status: 'rechazado', label: 'Rechazado' };
                break;
            case 4:
                return { status: 'revision', label: 'En revision' };
                break;
            case 6:
                return { status: 'atrasada', label: 'Atrasada' };
                break;
            default:
                return { status: '', label: '' };
        }
    }

    async function fetchHistorialTalleres(filtro = 'todos') {
        historyGridContainer.innerHTML = `<p>${t('workshop.loadingHistory')}</p>`;
        try {
            let url=null;
            switch (filtro){
                case "todos":
                    url = `${API_BASE_URL}/solicitudtaller`;
                    break;
                case "completado":
                    url = `${API_BASE_URL}/getTallerForStatus/5`;
                break;
                case "en-curso":
                    url = `${API_BASE_URL}/getTallerForStatus/2`;
                break;
                case "proximo":
                    url = `${API_BASE_URL}/getTallerForStatus/1`;
                    break;
                case "rechazado":
                    url = `${API_BASE_URL}/getTallerForStatus/3`;
                    break;
                case "revision":
                    url = `${API_BASE_URL}/getTallerForStatus/4`;
                    break;
                case "atrasada":
                    url = `${API_BASE_URL}/getTallerForStatus/6`;
                    break;
            }

            const response = await fetchWithAuth(url, { method: 'GET' });
            if (!response.ok) throw new Error("Error");
            const allData = await response.json();

            const filtradas = allData.filter(solicitud => {
                const visual = getVisualState(solicitud);
                if (filtro === 'todos') return true;
                return visual.status === filtro; 
            });

            if (filtradas.length === 0) { historyGridContainer.innerHTML = `<p>${t('workshop.noWorkshops')}</p>`; return; }

            historyGridContainer.innerHTML = '';
            filtradas.forEach(s => {
                const nombre = catalogoTalleres.find(c => c.idTaller === s.idTaller)?.nombreTaller || `Taller ${s.idTaller}`;
                const visual = getVisualState(s);
                const cliente = s.nombreAgricultor || `ID: ${s.idAgricultor}`;
                const fInicioStr = new Date(s.fechaAplicarTaller).toLocaleDateString('es-ES');
                const fFinStr = s.fechaFin ? new Date(s.fechaFin).toLocaleDateString('es-ES') : '...';
                
                // ★ AÑADIDO: Enlace para ver el comprobante en el historial del agrónomo ★
                const receiptHTML = s.estadoPagoImagen 
                    ? `<div style="margin-top:10px;"><img src="/Imagenes/eye.png" style="width:12px; opacity:0.6;"> <a href="#" class="view-receipt-link" data-url="${s.estadoPagoImagen}">${t('workshop.viewReceipt')}</a></div>` 
                    : '';

                const cardHTML = `
                    <div class="workshop-card">
                        <div class="card-body">
                            <p class="taller-label">Taller:</p>
                            <h5 class="taller-title">${nombre}</h5>
                            <div class="info-row"><img src="/Imagenes/user.png" class="info-icon"><div><span class="info-label">${t('workshop.client')}</span><p class="info-text">${cliente}</p></div></div>
                            <div class="info-row"><img src="/Imagenes/marker.png" class="info-icon"><div><span class="info-label">${t('workshop.location')}</span><p class="info-text">${s.direccion}</p></div></div>
                            <div class="expandable-content">
                                <div class="date-info"><p class="info-text">${t('workshop.startDate')} <br> ${fInicioStr}</p><p class="info-text" style="margin-top:5px;">${t('workshop.endDate')} <br> ${fFinStr}</p></div>
                                ${receiptHTML}
                            </div>
                        </div>
                        <div class="toggle-btn-container"><button class="toggle-btn"><span class="btn-text">${t('workshop.seeMore')}</span><span class="toggle-icon">▼</span></button></div>
                        <div class="card-footer footer-${visual.status}">${visual.status === 'completado' ? '✔' : (visual.status === 'en-curso' ? '▶' : visual.status === 'rechazado' ? '⌧' :
                    '⏱')} ${visual.label}</div>
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
                    btnText.textContent = content.classList.contains('open') ? t('workshop.seeLess') : t('workshop.seeMore');
                });
                
                const link = cardEl.querySelector('.view-receipt-link');
                if(link) {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        receiptImage.src = e.target.dataset.url;
                        openModalFunc(receiptModal);
                    });
                }
                
                historyGridContainer.appendChild(cardEl);
            });

        } catch (error) { historyGridContainer.innerHTML = `<p>${t('workshop.error')}</p>`; }
    }

    // ... (RESTO DE EVENTOS: nav, filtros, modales, eliminar, igual que antes) ...
    document.querySelector('.workshops-nav').addEventListener('click', (e) => {
        if (e.target.matches('.nav-button')) {
            document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const view = e.target.dataset.view;
            document.getElementById('view-capacitaciones').classList.toggle('hidden', view !== 'capacitaciones');
            document.getElementById('view-historial').classList.toggle('hidden', view !== 'historial');
            if (view === 'historial') {
                document.querySelector('.filter-buttons .filter-btn[data-filter="todos"]').click();
            } else { fetchTalleresDisponibles(); }
        }
    });

    document.querySelector('.filter-buttons').addEventListener('click', (e) => {
        if (e.target.matches('.filter-btn')) {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            fetchHistorialTalleres(e.target.dataset.filter);
        }
    });

    document.getElementById('addNewWorkshopBtn').addEventListener('click', () => {
        editingWorkshopId = null;
        workshopForm.reset();
        document.getElementById('modalTitle').textContent = t('workshop.addNewTitle');
        document.getElementById('deleteWorkshopBtn').classList.add('hidden');
        openModalFunc(modal);
    });

    document.getElementById('cancelWorkshop').addEventListener('click', () => closeModalFunc(modal));
    document.getElementById('saveWorkshop').addEventListener('click', () => workshopForm.requestSubmit());
    
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
            await fetchWithAuth(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            await fetchTalleresDisponibles();
            closeModalFunc(modal);
            showSuccess();
        } catch (err) { alert(err.message); }
    });
    
    workshopListContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-edit');
        if (btn) {
            editingWorkshopId = parseInt(btn.dataset.id);
            const taller = catalogoTalleres.find(x => x.idTaller === editingWorkshopId);
            if (taller) {
                workshopForm.elements['workshopName'].value = taller.nombreTaller;
                workshopForm.elements['workshopDescription'].value = taller.descripcion;
                workshopForm.elements['workshopCost'].value = taller.costo;
                document.getElementById('modalTitle').textContent = t('workshop.editTitle');
                document.getElementById('deleteWorkshopBtn').classList.remove('hidden');
                openModalFunc(modal);
            }
        }
    });

    document.getElementById('deleteWorkshopBtn').addEventListener('click', () => { closeModalFunc(modal); openModalFunc(deleteModal); });
    document.getElementById('cancelDelete').addEventListener('click', () => closeModalFunc(deleteModal));
    document.getElementById('acceptDelete').addEventListener('click', async () => {
         try {
            await fetchWithAuth(`${API_BASE_URL}/talleres/${editingWorkshopId}`, { method: 'DELETE' });
            await fetchTalleresDisponibles();
            closeModalFunc(deleteModal);
        } catch (e) { alert(e.message); closeModalFunc(deleteModal); }
    });
    
    if(closeReceipt) closeReceipt.addEventListener('click', () => closeModalFunc(receiptModal));

    await loadProfileAndGreeting();
    await fetchTalleresDisponibles();
});