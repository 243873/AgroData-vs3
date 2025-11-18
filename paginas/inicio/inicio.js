document.addEventListener('DOMContentLoaded', async () => {
    const authString = localStorage.getItem('usuarioActual');
    const usuarioActual = authString ? JSON.parse(authString) : null;

    if (!usuarioActual || !usuarioActual.id || !usuarioActual.rol || !usuarioActual.token) {
        localStorage.clear();
        window.location.href = '/index.html';
        return;
    }

    if (usuarioActual.rol !== 1) {
        localStorage.clear(); 
        window.location.href = '/index.html';
        return;
    }
    
    const userId = usuarioActual.id;
    const authToken = usuarioActual.token; 
    
    const welcomeMessage = document.getElementById('welcomeMessage');
    const notificationsList = document.querySelector('.notifications-list');
    const emptyView = document.querySelector('.notification-empty');
    
    async function fetchWithCors(url, options = {}) {
        const defaultHeaders = { 'Authorization': `Bearer ${authToken}` };
        const finalHeaders = { ...defaultHeaders, ...(options.headers || {}) };
        const finalOptions = { ...options, headers: finalHeaders };
        return fetch(url, finalOptions);
    }
    
    async function loadProfileAndGreeting() {
        if (!welcomeMessage) return; 
        try {
            const response = await fetchWithCors(`${API_BASE_URL}/perfil/${userId}`, { method: 'GET' });
            if (response.ok) {
                const user = await response.json();
                welcomeMessage.textContent = `${t('common.welcome')}, ${user.nombre}`;
            } else {
                welcomeMessage.textContent = `${t('common.welcome')}, ${t('common.agronomist')}`;
            }
        } catch (error) {
            welcomeMessage.textContent = `${t('common.welcome')}, ${t('common.agronomist')}`; 
        }
    }

    // --- 4. MODAL DE CONFIRMACIÓN ---
    const modal = document.getElementById('confirmationModal');
    const cancelButton = document.getElementById('cancelButton');
    const acceptButton = document.getElementById('acceptButton');
    let notificationToRemove = null;

    const openConfirmationModal = (element) => {
        notificationToRemove = element;
        if (modal) modal.classList.remove('hidden');
    };

    const closeConfirmationModal = () => {
        notificationToRemove = null;
        if (modal) modal.classList.add('hidden');
    };
    
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
        if (!notificationsList || !emptyView) return;

        try {
            const response = await fetchWithCors(`${API_BASE_URL}/notificacionesagronomo`, { method: 'GET' });
            if (response.status === 401 || response.status === 403) {
                localStorage.clear();
                window.location.href = '/index.html';
                return; 
            }
            if (!response.ok) throw new Error(`Error de API: ${response.status}`);

            const notificaciones = await response.json();
            renderNotificaciones(notificaciones);

        } catch (error) {
            console.error('Error al cargar notificaciones:', error);
            notificationsList.innerHTML = `<p style="text-align: center; color: red;">${t('error.loadNotifications')}</p>`;
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
            const infoExtra = notif.mensajeAdicional; // ID del plan para tareas

            let texto = '';
            let link = '#';
            let linkText = 'Revisar';

            switch (tipo) {
                case 'asesoria':
                    // Cambio 1: Quitamos el ID del mensaje
                    texto = t('notifications.newAdvisory');
                    link = '/paginas/solicitudes/solicitudes.html';
                    linkText = t('notifications.goToRequests');
                    break;
                case 'taller':
                    // Cambio 1b: Quitamos el ID para consistencia
                    texto = t('notifications.newWorkshop');
                    link = '/paginas/solicitudes/solicitudes.html';
                    linkText = t('notifications.goToRequests');
                    break;
                case 'tarea':
                    // Cambio 2: Usamos el ID del Plan en lugar del ID de la tarea
                    const planText = infoExtra ? `${t('notifications.cultivationPlan')} #${infoExtra}` : `(ID: ${id})`;
                    
                    if (estado.toLowerCase() === 'completada') {
                        texto = `${t('notifications.taskCompleted')} ${planText} ${t('notifications.requiresReview')}.`;
                    } else if (estado.toLowerCase() === 'pendiente') {
                        texto = `${t('notifications.taskPending')} ${planText} ${t('notifications.pendingCompletion')}.`;
                    } else {
                        texto = `${t('notifications.taskNewStatus')} ${planText} ${t('notifications.hasNewStatus')}: '${estado}'.`;
                    }
                    link = '/paginas/proyectos/proyectos.html'; 
                    linkText = t('notifications.goToProjects');
                    break;
                default:
                    texto = `${t('common.notification')} ${t('notifications.withStatus')}: ${estado}.`;
            }

            const item = document.createElement('div');
            item.className = 'notification-item';
            item.setAttribute('data-id', id);
            item.setAttribute('data-tipo', tipo);

            item.innerHTML = `
                <span class="notification-text">${texto}</span>
                <div class="notification-actions">
                    <a href="${link}" class="btn btn-primary">${linkText}</a>
                    <button class="btn btn-danger" data-i18n="notifications.discard">Descartar</button>
                </div>
            `;
            notificationsList.appendChild(item);
        });
    }

    // --- EJECUCIÓN INICIAL ---
    await loadProfileAndGreeting(); 
    await fetchAndRenderNotificaciones();
});