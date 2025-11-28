document.addEventListener('DOMContentLoaded', async () => {
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual'));
    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        localStorage.clear(); 
        window.location.href = '../../index.html'; 
        return;
    }
    const authToken = authInfo.token;
    
    const workshopListContainer = document.getElementById('workshop-list');
    const historyGridContainer = document.getElementById('workshop-history-grid');
    const viewEstadisticas = document.getElementById('view-estadisticas');
    
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
    let myChart = null;

    if(addNewWorkshopBtn) addNewWorkshopBtn.innerHTML = `<span>+</span> ${typeof t === 'function' ? t('workshop.addNew') : 'Agregar nuevo taller'}`;

    async function fetchWithAuth(url, options = {}) {
        const headers = { 'Authorization': `Bearer ${authToken}`, ...(options.headers || {}) };
        return await fetch(url, { ...options, headers });
    }

    const openModalFunc = (m) => m.classList.remove('hidden');
    const closeModalFunc = (m) => m.classList.add('hidden');
    
    const showSuccess = () => { 
        const title = successModal.querySelector('h2');
        if(title) title.textContent = typeof t === 'function' ? t('workshop.saved') : 'Cambios guardados'; 
        openModalFunc(successModal); 
        setTimeout(() => closeModalFunc(successModal), 2000); 
    };

    async function loadProfileAndGreeting() {
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });
            if (res.ok) { 
                const u = await res.json(); 
                if(welcomeMessage) welcomeMessage.textContent = `${typeof t === 'function' ? t('greeting.welcome') : 'Bienvenido'}, ${u.nombre}`; 
            }
        } catch (e) { console.error(e); }
    }
    async function fetchTalleresDisponibles() {
        workshopListContainer.innerHTML = `<p>${typeof t === 'function' ? t('workshop.loading') : 'Cargando...'}</p>`;
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/talleres/`, { method: 'GET' });
            if (res.ok) { catalogoTalleres = await res.json(); renderTalleresDisponibles(); }
        } catch (e) { console.error(e); }
    }

    const renderTalleresDisponibles = () => {
        workshopListContainer.innerHTML = '';
        catalogoTalleres.forEach(taller => {
            const div = document.createElement('div');
            div.className = 'workshop-item';
            div.innerHTML = `
                <div class="workshop-header">
                    <h5>${taller.nombreTaller}</h5>
                    <button class="btn btn-edit" data-id="${taller.idTaller}">${typeof t === 'function' ? t('common.edit') : 'Editar'}</button>
                </div>
                <p class="workshop-description">${taller.descripcion}</p>
                <p class="workshop-cost">${typeof t === 'function' ? t('workshop.cost') : 'Costo'}: $${taller.costo.toLocaleString()}</p>
            `;
            workshopListContainer.appendChild(div);
        });
    };

    function getVisualState(taller) {
        switch (taller.idEstado){
            case 5: return { status: 'completado', label: 'Completado' };
            case 1: return { status: 'proximo', label: 'Próximo' };
            case 2: return { status: 'en-curso', label: 'En curso' };
            case 3: return { status: 'rechazado', label: 'Rechazado' };
            case 4: return { status: 'revision', label: 'En revision' };
            case 6: return { status: 'atrasada', label: 'Atrasada' };
            default: return { status: '', label: '' };
        }
    }
    async function fetchHistorialTalleres(filtro = 'todos') {
        historyGridContainer.innerHTML = `<p>${typeof t === 'function' ? t('workshop.loadingHistory') : 'Cargando historial...'}</p>`;
        try {
            let url = `${API_BASE_URL}/solicitudtaller`;
            if (filtro === "completado") url = `${API_BASE_URL}/getTallerForStatus/5`;
            else if (filtro === "en-curso") url = `${API_BASE_URL}/getTallerForStatus/2`;
            else if (filtro === "proximo") url = `${API_BASE_URL}/getTallerForStatus/1`;
            else if (filtro === "rechazado") url = `${API_BASE_URL}/getTallerForStatus/3`;
            else if (filtro === "revision") url = `${API_BASE_URL}/getTallerForStatus/4`;
            else if (filtro === "atrasada") url = `${API_BASE_URL}/getTallerForStatus/6`;

            const response = await fetchWithAuth(url, { method: 'GET' });
            if (!response.ok) throw new Error("Error fetching history");
            const allData = await response.json();

            const filtradas = allData.filter(solicitud => {
                if (filtro === 'todos') return true;
                const visual = getVisualState(solicitud);
                return visual.status === filtro; 
            });

            if (filtradas.length === 0) { 
                historyGridContainer.innerHTML = `<p>${typeof t === 'function' ? t('workshop.noWorkshops') : 'No hay talleres en este estado.'}</p>`; 
                return; 
            }

            historyGridContainer.innerHTML = '';
            filtradas.forEach(s => {
                const nombre = catalogoTalleres.find(c => c.idTaller === s.idTaller)?.nombreTaller || `Taller ${s.idTaller}`;
                const visual = getVisualState(s);
                const cliente = s.nombreAgricultor || `ID: ${s.idAgricultor}`;
                const fInicioStr = new Date(s.fechaAplicarTaller).toLocaleDateString('es-ES');
                const fFinStr = s.fechaFin ? new Date(s.fechaFin).toLocaleDateString('es-ES') : '...';
                
                const receiptHTML = s.estadoPagoImagen 
                    ? `<div style="margin-top:10px;"><img src="/Imagenes/eye.png" style="width:12px; opacity:0.6;"> <a href="#" class="view-receipt-link" data-url="${s.estadoPagoImagen}">${typeof t === 'function' ? t('workshop.viewReceipt') : 'Ver comprobante'}</a></div>` 
                    : '';

                const cardHTML = `
                    <div class="workshop-card">
                        <div class="card-body">
                            <p class="taller-label">Taller:</p>
                            <h5 class="taller-title">${nombre}</h5>
                            <div class="info-row"><img src="/Imagenes/user.png" class="info-icon"><div><span class="info-label">${typeof t === 'function' ? t('workshop.client') : 'Cliente'}</span><p class="info-text">${cliente}</p></div></div>
                            <div class="info-row"><img src="/Imagenes/marker.png" class="info-icon"><div><span class="info-label">${typeof t === 'function' ? t('workshop.location') : 'Ubicación'}</span><p class="info-text">${s.direccion}</p></div></div>
                            <div class="expandable-content">
                                <div class="date-info"><p class="info-text">${typeof t === 'function' ? t('workshop.startDate') : 'Fecha Inicio'} <br> ${fInicioStr}</p><p class="info-text" style="margin-top:5px;">${typeof t === 'function' ? t('workshop.endDate') : 'Fecha Fin'} <br> ${fFinStr}</p></div>
                                ${receiptHTML}
                            </div>
                        </div>
                        <div class="toggle-btn-container"><button class="toggle-btn"><span class="btn-text">${typeof t === 'function' ? t('workshop.seeMore') : 'Ver más'}</span><span class="toggle-icon">▼</span></button></div>
                        <div class="card-footer footer-${visual.status}">${visual.status === 'completado' ? '✔' : (visual.status === 'en-curso' ? '▶' : visual.status === 'rechazado' ? '⌧' :'⏱')} ${visual.label}</div>
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
                    btnText.textContent = content.classList.contains('open') ? (typeof t === 'function' ? t('workshop.seeLess') : 'Ver menos') : (typeof t === 'function' ? t('workshop.seeMore') : 'Ver más');
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

        } catch (error) { historyGridContainer.innerHTML = `<p>${typeof t === 'function' ? t('workshop.error') : 'Error al cargar historial'}</p>`; }
    }

    async function loadEstadisticas() {
        const chartCanvas = document.getElementById('talleresChart');
        if (!chartCanvas) return;

        try {
 
            const response = await fetchWithAuth(`${API_BASE_URL}/solicitudtaller/estadisticas`, { method: 'GET' });
            
            if (!response.ok) throw new Error('Error cargando estadísticas');
            
            const data = await response.json();
            renderChart(data);

        } catch (error) {
            console.error("Error estadística:", error);
        }
    }

    function renderChart(data) {
        const ctx = document.getElementById('talleresChart').getContext('2d');

        const labels = data.map(item => item.nombreTaller);
        const totalValues = data.map(item => item.total);
        const completadosValues = data.map(item => item.completados);

        if (myChart) {
            myChart.destroy();
        }

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Solicitados',
                        data: totalValues,
                        backgroundColor: 'rgba(200, 200, 200, 0.6)', 
                        borderColor: '#999',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Completados',
                        data: completadosValues,
                        backgroundColor: 'rgba(28, 110, 62, 0.85)', 
                        borderColor: '#1C6E3E',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top' }, // Mostrar leyenda
                    tooltip: { mode: 'index', intersect: false } // Tooltip compartido
                }
            }
        });
    }

    document.querySelector('.workshops-nav').addEventListener('click', (e) => {
        if (e.target.matches('.nav-button')) {
            document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const view = e.target.dataset.view;
            
            document.getElementById('view-capacitaciones').classList.toggle('hidden', view !== 'capacitaciones');
            document.getElementById('view-historial').classList.toggle('hidden', view !== 'historial');
            if (viewEstadisticas) viewEstadisticas.classList.toggle('hidden', view !== 'estadisticas');

            if (view === 'historial') {
                document.querySelectorAll('#view-historial .filter-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('#view-historial .filter-btn[data-filter="todos"]').classList.add('active');
                fetchHistorialTalleres('todos');
            } else if (view === 'estadisticas') {
                loadEstadisticas(); 
            } else {
                fetchTalleresDisponibles();
            }
        }
    });

    const historialFilters = document.querySelector('#view-historial .filter-buttons');
    if (historialFilters) {
        historialFilters.addEventListener('click', (e) => {
            if (e.target.matches('.filter-btn')) {
                historialFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                fetchHistorialTalleres(e.target.dataset.filter);
            }
        });
    }
    document.getElementById('addNewWorkshopBtn').addEventListener('click', () => {
        editingWorkshopId = null;
        workshopForm.reset();
        document.getElementById('modalTitle').textContent = typeof t === 'function' ? t('workshop.addNewTitle') : 'Agregar nuevo taller';
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
                document.getElementById('modalTitle').textContent = typeof t === 'function' ? t('workshop.editTitle') : 'Editar taller';
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