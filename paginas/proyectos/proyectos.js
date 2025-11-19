document.addEventListener('DOMContentLoaded', async () => {
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual')); 

    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        console.error("Acceso denegado o sesión inválida.");
        localStorage.clear();
        window.location.href = '../../index.html';
        return;
    }
    
    const authToken = authInfo.token;
    
    // --- ELEMENTOS DEL DOM ---
    const projectsListContainer = document.getElementById('projects-list-container');
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    let allProjects = []; 

    // --- ★ LÓGICA DE FILTROS (MODIFICADA) ★ ---
    // IDs de Estado: 1=Pendiente, 2=En Progreso, 3=En Progreso, 4=Rechazado, 5=Completado
    const STATUS_MAP = {
        5: { text: 'Completado', filter: 'completado' },
        4: { text: 'Rechazado', filter: 'rechazado' }, // Opcional si quieres mostrar rechazados
        // Todos los demás se consideran "En Progreso" por defecto en la función de renderizado
    };

    // --- FUNCIONES HELPER (API) ---
    async function fetchWithAuth(url, options = {}) {
        const headers = { 'Authorization': `Bearer ${authToken}`, ...(options.headers || {}) };
        return await fetch(url, { ...options, headers });
    }

    async function loadProfileAndGreeting() {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });
            if (response.ok) {
                const user = await response.json();
                if (welcomeMessage) welcomeMessage.textContent = `${t('greeting.welcome')}, ${user.nombre}`;
            } else {
                if (welcomeMessage) welcomeMessage.textContent = `${t('greeting.welcome')}, ${t('common.agronomist')}`;
            }
        } catch (error) { 
            console.error('Error al cargar saludo:', error);
            if (welcomeMessage) welcomeMessage.textContent = `${t('greeting.welcome')}, ${t('common.agronomist')}`;
        }
    }

    // --- LÓGICA DE DATOS ---
    async function fetchAllProjects() {
        projectsListContainer.innerHTML = `<p class="loading-message">${t('projects.loading')}</p>`;
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/obtenerPlanCultivos`, { method: 'GET' });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            
            allProjects = await response.json();
            renderProjects(); 

        } catch (error) {
            console.error('Error al obtener la lista de proyectos:', error);
            projectsListContainer.innerHTML = `<p class="error-message">${t('error.loadProjects')}</p>`;
        }
    }

    // --- LÓGICA DE RENDERIZADO ---
    function renderProjects(filterKey = 'all') {
        projectsListContainer.innerHTML = '';
        let projectsToRender = [];

        // ★ LÓGICA DE FILTRADO ★
        if (filterKey === 'all') {
            projectsToRender = allProjects;
        } else {
            projectsToRender = allProjects.filter(p => {
                // Si es estado 5, es 'completado'. Cualquier otro (que no sea rechazado) es 'en-progreso'
                if (filterKey === 'completado') return p.idEstado === 2;
                if (filterKey === 'en-progreso') return p.idEstado !== 5 && p.idEstado !== 4; 
                return false;
            });
        }

        if (projectsToRender.length === 0) {
            projectsListContainer.innerHTML = `<p>${t('projects.noProjects')}</p>`;
            return;
        }

        projectsToRender.forEach(project => {
            const fullName = `${project.nombre} ${project.apellidoPaterno || ''} ${project.apellidoMaterno || ''}`;
            const cultivosNombres = project.cultivoPorSolicitud ? project.cultivoPorSolicitud.map(c => c.nombreCultivo).join(', ') : 'N/A';
            const detailUrl = `proyecto-detalle.html?idPlan=${project.idPlan}&idSolicitud=${project.idSolicitud}`;

            const card = document.createElement('a');
            card.className = 'project-card';
            card.href = detailUrl;
            
            card.innerHTML = `
                <div class="card-info">
                    <h5>${t('projects.cultivationPlan')} ${cultivosNombres}</h5>
                    <div class="card-info-details">
                        <p><img src="/Imagenes/user.png" class="icon"> ${fullName}</p>
                        <p><img src="/Imagenes/marker.png" class="icon"> ${project.direccionTerreno}</p>
                        <p><img src="/Imagenes/tree-sapling.png" class="icon"> ${t('projects.crops')} ${cultivosNombres}</p>
                    </div>
                </div>
                <div class="card-actions">
                    <span class="btn-details">${t('projects.details')}</span>
                </div>`;
            
            projectsListContainer.appendChild(card);
        });
    }

    // --- MANEJO DE EVENTOS ---
    document.querySelector('.filter-buttons').addEventListener('click', e => {
        if (e.target.matches('.filter-btn')) {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            renderProjects(e.target.dataset.filter);
        }
    });

    // --- INICIALIZACIÓN ---
    await loadProfileAndGreeting();
    await fetchAllProjects();
});