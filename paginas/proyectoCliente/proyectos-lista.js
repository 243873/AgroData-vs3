document.addEventListener('DOMContentLoaded', async () => { // <--- Hecho ASYNC
    // 1. VERIFICACIÓN DE USUARIO (con Token)
    const currentUser = JSON.parse(localStorage.getItem('usuarioActual'));
    if (!currentUser || !currentUser.token) { 
        window.location.href = '/index.html'; 
        return; 
    }
    const authToken = currentUser.token;

    // 2. ELEMENTOS DEL DOM
    const projectsListContainer = document.getElementById('projects-list-container');
    const welcomeMessage = document.getElementById('welcomeMessage');

    /**
     * Función 'fetch' personalizada que añade el token
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

        const response = await fetch(url, finalOptions);

        if (!response.ok) {
            if (response.status === 401) { // Token inválido o expirado
                window.location.href = '/index.html';
            }
            throw new Error(`Error de API: ${response.status}`);
        }
        return response.json();
    }

    /**
     * Carga el perfil del usuario para obtener el nombre
     */
    async function fetchUserProfile() {
        try {
            const userProfile = await fetchWithToken(`${API_BASE_URL}/perfil/${currentUser.id}`);
            welcomeMessage.textContent = `Bienvenido, ${userProfile.nombre}`;
        } catch (error) {
            console.error("Error al cargar perfil:", error);
            welcomeMessage.textContent = `Bienvenido, Usuario (ID: ${currentUser.id})`;
        }
    }

    /**
     * Llama a la API para obtener TODOS los planes de cultivo
     */
    async function getAllProjectsFromAPI() {
        try {
            // Llama al endpoint del backend
            const allProjects = await fetchWithToken(`${API_BASE_URL}/obtenerPlanCultivos`);
            
            // La API devuelve *todos* los proyectos.
            // Filtramos en el cliente solo los que pertenecen a este usuario.
            const myProjects = allProjects.filter(project => project.idUsuario === currentUser.id);
            return myProjects;

        } catch (error) {
            console.error("Error cargando proyectos:", error);
            projectsListContainer.innerHTML = '<div class="empty-state-message"><p>Error al cargar proyectos. (Probable error de CORS)</p></div>';
            return [];
        }
    }

    /**
     * Renderiza las tarjetas de proyecto en el HTML
     */
    async function renderProjects() {
        projectsListContainer.innerHTML = '<p>Cargando proyectos...</p>';
        const myProjects = await getAllProjectsFromAPI();
        
        if (myProjects.length === 0) {
            projectsListContainer.innerHTML = '<div class="empty-state-message"><p>Aún no tienes proyectos asignados.</p></div>';
            return;
        }

        projectsListContainer.innerHTML = ''; // Limpiar "Cargando..."
        
        myProjects.forEach(project => {
            // Mapeamos los datos del modelo PlanCultivo
            const cultivosNombres = project.cultivoPorSolicitud.map(c => c.nombreCultivo).join(', ');

            const card = `
                <a href="proyectoCliente.html?id=${project.idPlan}" class="project-card">
                    <div class="card-info">
                        <h5>Plan de Cultivo: ${cultivosNombres}</h5>
                        <div class="card-info-details">
                            <p><img src="/Imagenes/user.png" class="icon"> ${project.nombre} ${project.apellidoPaterno}</p>
                            <p><img src="/Imagenes/marker.png" class="icon"> ${project.direccionTerreno}</p>
                            <p><img src="/Imagenes/tree-sapling.png" class="icon"> Cultivos: ${cultivosNombres}</p>
                        </div>
                    </div>
                    <div class="card-actions">
                        <span class="btn-details">Ver Detalles</span>
                    </div>
                </a>`;
            projectsListContainer.innerHTML += card;
        });
    }

    // 4. INICIALIZACIÓN
    await fetchUserProfile(); // Carga el nombre primero
    await renderProjects();   // Luego carga los proyectos
});