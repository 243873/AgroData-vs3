document.addEventListener('DOMContentLoaded', async () => {
    // --- URL DEL SERVIDOR y AUTENTICACIÓN ---
    const API_BASE_URL = 'http://localhost:7000';
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
    const deleteModal = document.getElementById('delete-modal');
    const welcomeMessage = document.getElementById('welcomeMessage'); // Elemento a corregir
    
    let projectIdToDelete = null;
    let allProjects = []; 

    // --- Mapeo de Estados de PlanCultivo ---
    const STATUS_MAP = {
        1: { text: 'Pendiente', filter: 'pendiente' },
        2: { text: 'En Progreso', filter: 'en-progreso' },
        3: { text: 'En Progreso', filter: 'en-progreso' },
        4: { text: 'Rechazado', filter: 'rechazado' },
        5: { text: 'Completado', filter: 'completado' }, 
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
                // ✅ CORRECCIÓN 1: Saludo dinámico exitoso
                if (welcomeMessage) welcomeMessage.textContent = `Bienvenido, ${user.nombre}`;
            } else {
                // ✅ CORRECCIÓN 2: Saludo por defecto si el fetch falla (status != 200)
                if (welcomeMessage) welcomeMessage.textContent = `Bienvenido, Agrónomo`;
            }
        } catch (error) { 
            console.error('Error al cargar saludo:', error);
            // ✅ CORRECCIÓN 3: Saludo por defecto si el fetch falla (excepción)
            if (welcomeMessage) welcomeMessage.textContent = `Bienvenido, Agrónomo`;
        }
    }

    // --- LÓGICA DE DATOS ---
    async function fetchAllProjects() {
        projectsListContainer.innerHTML = '<p class="loading-message">Cargando planes de cultivo...</p>';
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/obtenerPlanCultivos`, { method: 'GET' });
            if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
            
            allProjects = await response.json();
            renderProjects(); 

        } catch (error) {
            console.error('Error al obtener la lista de proyectos:', error);
            projectsListContainer.innerHTML = `<p class="error-message">Error al cargar proyectos.</p>`;
        }
    }

    // --- LÓGICA DE RENDERIZADO ---
    // --- LÓGICA DE RENDERIZADO ---
    function renderProjects(filterKey = 'all') {
        projectsListContainer.innerHTML = '';
        let projectsToRender = allProjects;

        if (filterKey !== 'all') {
            projectsToRender = allProjects.filter(p => STATUS_MAP[p.idEstado] && STATUS_MAP[p.idEstado].filter === filterKey);
        }

        if (projectsToRender.length === 0) {
            projectsListContainer.innerHTML = '<p>No hay proyectos que coincidan con el filtro.</p>';
            return;
        }

        projectsToRender.forEach(project => {
            // --- ★ INICIO DE LA MODIFICACIÓN ★ ---
            // Se re-calculan las variables para que coincidan con la vista del cliente
            const estado = STATUS_MAP[project.idEstado] || { text: 'Desconocido', filter: 'desconocido' };
            const fullName = `${project.nombre} ${project.apellidoPaterno || ''} ${project.apellidoMaterno || ''}`;
            const cultivosNombres = project.cultivoPorSolicitud ? project.cultivoPorSolicitud.map(c => c.nombreCultivo).join(', ') : 'N/A';
            
            // La URL al detalle incluye los IDs necesarios
            const detailUrl = `proyecto-detalle.html?idPlan=${project.idPlan}&idSolicitud=${project.idSolicitud}`;

            // Se crea un <a> en lugar de un <div> para que toda la tarjeta sea un enlace
            const card = document.createElement('a');
            card.className = 'project-card';
            card.href = detailUrl;
            
            // Se usa la misma estructura HTML interna que 'proyectos-lista.js' del cliente
            // Se omite la barra de progreso y el span de estado.
            card.innerHTML = `
                <div class="card-info">
                    <h5>Plan de Cultivo: ${cultivosNombres}</h5>
                    <div class="card-info-details">
                        <p><img src="/Imagenes/user.png" class="icon"> ${fullName}</p>
                        <p><img src="/Imagenes/marker.png" class="icon"> ${project.direccionTerreno}</p>
                        <p><img src="/Imagenes/tree-sapling.png" class="icon"> Cultivos: ${cultivosNombres}</p>
                    </div>
                </div>
                <div class="card-actions">
                    <span class="btn-details">Ver Detalles</span>
                </div>`;
            // --- ★ FIN DE LA MODIFICACIÓN ★ ---
            
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
    // (La lógica de eliminación se ha omitido para la vista de lista, ya que se maneja en el detalle)

    // --- INICIALIZACIÓN ---
    await loadProfileAndGreeting();
    await fetchAllProjects();
});