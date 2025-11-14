document.addEventListener('DOMContentLoaded', async () => {
    // ===============================================
    // --- 1. CONFIGURACIÓN INICIAL Y VERIFICACIÓN DE SESIÓN ---
    // ===============================================
    
    const API_BASE_URL = "http://localhost:7000"; 
    const authString = localStorage.getItem('usuarioActual');
    const usuarioActual = authString ? JSON.parse(authString) : null;

    // --- MEJORA (Seguridad): Validar sesión y rol ---
    if (!usuarioActual || !usuarioActual.id || !usuarioActual.rol || !usuarioActual.token) {
        console.error("Sesión inválida. Redirigiendo a login.");
        localStorage.clear();
        window.location.href = '/index.html';
        return;
    }

    // --- MEJORA (Seguridad): Asegurar que solo el rol 1 (Agrónomo) esté aquí ---
    if (usuarioActual.rol !== 1) {
        console.error("Acceso denegado. Esta página es solo para agrónomos.");
        localStorage.clear(); // Limpiar sesión incorrecta
        window.location.href = '/index.html';
        return;
    }
    
    const userId = usuarioActual.id;
    const authToken = usuarioActual.token; 
    
    const welcomeMessage = document.getElementById('welcomeMessage');
    const notificationsList = document.querySelector('.notifications-list');
    const emptyView = document.querySelector('.notification-empty');
    
    // --- 2. FUNCIONES HELPER (fetchWithCors) ---
    async function fetchWithCors(url, options = {}) {
        const defaultHeaders = { 'Authorization': `Bearer ${authToken}` };
        const finalHeaders = { ...defaultHeaders, ...(options.headers || {}) };
        const finalOptions = { ...options, headers: finalHeaders };
        
        return fetch(url, finalOptions);
    }
    
    // --- 3. FUNCIÓN PARA CARGAR EL NOMBRE ---
    async function loadProfileAndGreeting() {
        if (!welcomeMessage) return; 

        try {
            // Esta llamada fallará con 404 si el servidor no se ha reconstruido
            const response = await fetchWithCors(`${API_BASE_URL}/perfil/${userId}`, { method: 'GET' });

            if (response.ok) {
                const user = await response.json();
                welcomeMessage.textContent = `Bienvenido, ${user.nombre}`;
            } else {
                // Si obtienes 404, verás este warn
                console.warn(`No se pudo cargar el nombre: ${response.status}`);
                welcomeMessage.textContent = `Bienvenido, Agrónomo`;
            }
        } catch (error) {
            console.error('Error al cargar datos de perfil para el saludo:', error);
            welcomeMessage.textContent = `Bienvenido, Agrónomo`; 
        }
    }


    // --- 4. FUNCIONES DE NOTIFICACIONES ---

    // IMPORTANTE: Busca el modal que AÑADISTE al HTML
    const modal = document.getElementById('confirmationModal');
    const cancelButton = document.getElementById('cancelButton');
    const acceptButton = document.getElementById('acceptButton');
    let notificationToRemove = null;

    const openConfirmationModal = (element) => {
        notificationToRemove = element;
        // MEJORA (Robustez): Comprobar si el modal existe
        if (modal) modal.classList.remove('hidden');
    };

    const closeConfirmationModal = () => {
        notificationToRemove = null;
        if (modal) modal.classList.add('hidden');
    };
    
    // MEJORA (Robustez): Comprobar si la lista existe antes de añadir listener
    if (notificationsList) {
        notificationsList.addEventListener('click', (event) => {
            const discardButton = event.target.closest('.btn-danger');
            if (discardButton && discardButton.textContent.trim() === 'Descartar') {
                const notificationItem = event.target.closest('.notification-item');
                if (notificationItem) {
                    openConfirmationModal(notificationItem);
                }
            }
        });
    }

    // MEJORA (Robustez): Comprobar botones
    if (acceptButton) {
        acceptButton.addEventListener('click', () => {
            if (notificationToRemove) {
                notificationToRemove.remove();
                if (notificationsList && notificationsList.querySelectorAll('.notification-item').length === 0) {
                    if (emptyView) emptyView.style.display = 'block';
                }
            }
            closeConfirmationModal();
        });
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', closeConfirmationModal);
    }


    async function fetchAndRenderNotificaciones() {
        if (!notificationsList || !emptyView) {
            console.error("No se encontraron los elementos de notificación en el DOM.");
            return;
        }

        try {
            const response = await fetchWithCors(`${API_BASE_URL}/notificacionesagronomo`, {
                method: 'GET'
            });

            // --- MEJORA (Robustez): Manejo de token expirado ---
            if (response.status === 401 || response.status === 403) {
                console.error("Token inválido o expirado. Redirigiendo a login.");
                localStorage.clear();
                window.location.href = '/index.html';
                return; // Detener la ejecución
            }

            if (!response.ok) {
                throw new Error(`Error de API: ${response.status}`);
            }

            const notificaciones = await response.json();
            renderNotificaciones(notificaciones);

        } catch (error) {
            console.error('Error fatal al cargar notificaciones:', error);
            notificationsList.innerHTML = `<p style="text-align: center; color: red;">Error al cargar las notificaciones.</p>`;
            emptyView.style.display = 'none';
        }
    }

    function renderNotificaciones(notificaciones) {
        notificationsList.innerHTML = ''; 

        if (notificaciones.length === 0) {
            emptyView.style.display = 'block';
            return;
        }

        emptyView.style.display = 'none';

        notificaciones.forEach(notif => {
            const tipo = notif.tipoNotificacion;
            const id = notif.idNotificacion;
            const estado = notif.nombreEstado; 

            let texto = '';
            let link = '#';
            let linkText = 'Revisar';

            switch (tipo) {
                case 'asesoria':
                    texto = `¡Nueva solicitud de Asesoría (ID: ${id})! Un cliente espera aprobación.`;
                    link = '/paginas/solicitudes/solicitudes.html';
                    linkText = 'Ir a Solicitudes';
                    break;
                case 'taller':
                    texto = `¡Nueva solicitud de Taller (ID: ${id})! Un cliente espera aprobación.`;
                    link = '/paginas/solicitudes/solicitudes.html';
                    linkText = 'Ir a Solicitudes';
                    break;
                case 'tarea':
                    if (estado.toLowerCase() === 'completada') {
                        texto = `La Tarea (ID: ${id}) fue marcada como 'Completada' y requiere tu revisión.`;
                    } else if (estado.toLowerCase() === 'pendiente') {
                        texto = `La Tarea (ID: ${id}) está 'Pendiente' de ser completada.`;
                    } else {
                        texto = `La Tarea (ID: ${id}) tiene un nuevo estado: '${estado}'.`;
                    }
                    link = '/paginas/proyectos/proyectos.html'; 
                    linkText = 'Ir a Proyectos';
                    break;
                default:
                    texto = `Notificación (ID: ${id}) con estado: ${estado}.`;
            }

            const item = document.createElement('div');
            item.className = 'notification-item';
            item.setAttribute('data-id', id);
            item.setAttribute('data-tipo', tipo);

            item.innerHTML = `
                <span class="notification-text">${texto}</span>
                <div class="notification-actions">
                    <a href="${link}" class="btn btn-primary">${linkText}</a>
                    <button class="btn btn-danger">Descartar</button>
                </div>
            `;
            notificationsList.appendChild(item);
        });
    }

    // --- 5. EJECUCIÓN INICIAL ---
    await loadProfileAndGreeting(); // Cargar el nombre primero
    await fetchAndRenderNotificaciones(); // Luego cargar las notificaciones
});