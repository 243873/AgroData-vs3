document.addEventListener('DOMContentLoaded', async () => { 

    const currentUser = JSON.parse(localStorage.getItem('usuarioActual'));
    if (!currentUser || !currentUser.token) { 
        window.location.href = '/index.html'; 
        return; 
    }
    const authToken = currentUser.token;

    const projectsListContainer = document.getElementById('projects-list-container');
    const welcomeMessage = document.getElementById('welcomeMessage');

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

        const response = await fetch(url, finalOptions);

        if (!response.ok) {
            if (response.status === 401) { 
                window.location.href = '/index.html';
            }
            throw new Error(`Error de API: ${response.status}`);
        }
        return response.json();
    }

    async function fetchUserProfile() {
        try {
            const userProfile = await fetchWithToken(`${API_BASE_URL}/perfil/${currentUser.id}`);
            welcomeMessage.textContent = `${t('greeting.welcome')}, ${userProfile.nombre}`;
        } catch (error) {
            console.error("Error al cargar perfil:", error);
            welcomeMessage.textContent = `${t('greeting.welcome')}, Usuario (ID: ${currentUser.id})`;
        }
    }

    async function getAllProjectsFromAPI() {
        try {

            const allProjects = await fetchWithToken(`${API_BASE_URL}/obtenerPlanCultivos`);
            
            const myProjects = allProjects.filter(project => project.idUsuario === currentUser.id);
            return myProjects;

        } catch (error) {
            console.error("Error cargando proyectos:", error);
            projectsListContainer.innerHTML = `<div class="empty-state-message"><p>${t('project.loadError')}</p></div>`;
            return [];
        }
    }
    const STATUS_MAP = {
        2: { text: 'En Progreso', filter: 'aceptada' },
        5: { text: 'Completado', filter: 'completado' },
        3: { text: 'Rechazado', filter: 'rechazada' }, 
    };

    async function renderProjects() {
        projectsListContainer.innerHTML = `<p>${t('common.loading')}</p>`;
        const myProjects = await getAllProjectsFromAPI();
        
        if (myProjects.length === 0) {
            projectsListContainer.innerHTML = `<div class="empty-state-message"><p>${t('error.noProjects')}</p></div>`;
            return;
        }

        projectsListContainer.innerHTML = ''; // Limpiar "Cargando..."
        
        myProjects.forEach(project => {
            const estado = STATUS_MAP[project.idEstado] || { text: 'Desconocido', filter: 'desconocido' };
            const cultivosNombres = project.cultivoPorSolicitud.map(c => c.nombreCultivo).join(', ');

            const card = `
                <a href="proyectoCliente.html?id=${project.idPlan}" class="project-card">
                    <div class="card-info">
                        <h5>ID ${project.idPlan} ${t('project.cultivationPlan')} ${cultivosNombres}</h5>
                        <div class="card-info-details">
                            <p><img src="/Imagenes/user.png" class="icon"> ${project.nombre} ${project.apellidoPaterno}</p>
                            <p><img src="/Imagenes/marker.png" class="icon"> ${project.direccionTerreno}</p>
                            <p><img src="/Imagenes/tree-sapling.png" class="icon"> ${t('projects.crops')} ${cultivosNombres}</p>
                        </div>
                    </div>
                    <div class="card-actions">
                        <span class="project-status status-${estado.filter}">${estado.text}</span>
                        <span class="btn-details">${t('projects.details')}</span>
                    </div>
                </a>`;
            projectsListContainer.innerHTML += card;
        });
    }

    // 4. INICIALIZACIÓN
    await fetchUserProfile(); // Carga el nombre primero
    await renderProjects();   // Luego carga los proyectos
});