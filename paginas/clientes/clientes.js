document.addEventListener('DOMContentLoaded', async () => {
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual')); 

    if (!authInfo || authInfo.rol !== 1 || !authInfo.token) {
        console.error("Acceso denegado o sesión inválida. Redirigiendo a login.");
        localStorage.clear();
        window.location.href = '../../index.html';
        return;
    }
    
    const authToken = authInfo.token;
    
    // --- ELEMENTOS DEL DOM ---
    const clientGrid = document.getElementById('client-grid');
    const clientCountElement = document.getElementById('client-count');
    const welcomeMessage = document.getElementById('welcomeMessage');

    // --- FUNCIONES HELPER (API) ---

    async function fetchWithAuth(url, options = {}) {
        const headers = {
            'Authorization': `Bearer ${authToken}`,
            ...(options.headers || {})
        };
        const finalOptions = { ...options, headers };
        return await fetch(url, finalOptions);
    }
    
    async function loadProfileAndGreeting() {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });

            if (response.ok) {
                const user = await response.json();
                if (welcomeMessage) {
                    // ✅ CORRECCIÓN 1: Saludo dinámico exitoso
                    welcomeMessage.textContent = `Bienvenido, ${user.nombre}`;
                    authInfo.nombre = user.nombre;
                    localStorage.setItem('usuarioActual', JSON.stringify(authInfo));
                }
            } else {
                // ✅ CORRECCIÓN 2: Saludo por defecto si el fetch falla (status != 200)
                if (welcomeMessage) welcomeMessage.textContent = `${t('common.welcome')}, ${t('common.agronomist')}`;
            }
        } catch (error) {
            console.error('Error al cargar datos de perfil para el saludo:', error);
            // ✅ CORRECCIÓN 3: Saludo por defecto si el fetch falla (excepción)
            if (welcomeMessage) welcomeMessage.textContent = `${t('common.welcome')}, ${t('common.agronomist')}`;
        }
    }


    // --- FUNCIÓN PARA RENDERIZAR CLIENTES ---

    const renderClientes = (clientes) => {
        clientGrid.innerHTML = '';

        if (clientes.length === 0) {
            clientGrid.innerHTML = `<p>${t('clients.noClients')}</p>`;
            clientCountElement.textContent = t('client.noClients');
            return;
        }
        
        clientCountElement.textContent = `${t('client.totalClients')} ${clientes.length} ${t('client.clientsWord')}`;

        clientes.forEach(cliente => {
            const fullName = `${cliente.nombre} ${cliente.apellidoPaterno || ''} ${cliente.apellidoMaterno || ''}`.trim();
            const cultivosArray = cliente.cultivos ? cliente.cultivos.split(',').map(c => c.trim()) : [];
            const cultivosHtml = cultivosArray.map(cultivo => `<span class="cultivo-tag">${cultivo}</span>`).join('');
            
            const ubicacionDisplay = cliente.direcciones ? cliente.direcciones.split('\n')[0] : 'N/A';
            const areaDisplay = cliente.superficieTotal ? cliente.superficieTotal.toFixed(2) : '0.00';

            const card = document.createElement('div');
            card.className = 'client-card';
            
            card.innerHTML = `
                <div class="client-card-header">
                    <h5>${fullName}</h5>
                </div>
                <div class="client-info">
                    <p><img src="/Imagenes/marker.png" class="info-icon"> ${ubicacionDisplay}</p>
                    <p><img src="/Imagenes/envelope.png" class="info-icon"> ${cliente.correo}</p>
                    <p><img src="/Imagenes/phone-flip.png" class="info-icon"> ${cliente.telefono}</p>
                </div>
                <div class="more-details">
                    <p><strong data-i18n="clients.registeredCrops">Cultivos registrados:</strong></p>
                    <div class="cultivos-list">${cultivosHtml}</div>
                    <p><strong data-i18n="clients.totalAreas">Total de áreas:</strong> ${areaDisplay} ${t('common.hectares')}</p>
                    ${cliente.direcciones && cliente.direcciones.includes('\n') ? `<p class="direccion-completa hidden"><strong data-i18n="clients.completeAddresses">Direcciones completas:</strong><br>${cliente.direcciones.replace(/\n/g, '<br>')}</p>` : ''}
                </div>
                <div class="toggle-details">
                    <img src="/Imagenes/angle-small-down.png" class="toggle-icon">
                    <span>Ver más</span>
                </div>
            `;
            clientGrid.appendChild(card);
        });
    };

    /**
     * Llama a la API para obtener la lista de clientes.
     */
    async function fetchClientes() {
        clientGrid.innerHTML = `<p class="loading-message">${t('clients.loading')}</p>`;
        clientCountElement.textContent = t('common.loading');

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/informacionGeneral`, { method: 'GET' });

            if (!response.ok) {
                // Si falla, muestra un mensaje amigable, no el error crudo.
                clientGrid.innerHTML = `<p class="error-message">${t('error.loadClientData')}</p>`;
                clientCountElement.textContent = t('error.loadError');
                return;
            }

            const clientesData = await response.json();
            renderClientes(clientesData);
            
        } catch (error) {
            console.error('Error al obtener la lista de clientes:', error);
            clientGrid.innerHTML = `<p class="error-message">${t('error.serverConnection')}</p>`;
            clientCountElement.textContent = t('error.loadError');
        }
    }

    // --- MANEJO DE EVENTOS (EVENT DELEGATION) ---
    clientGrid.addEventListener('click', (event) => {
        const toggleButton = event.target.closest('.toggle-details');

        if (toggleButton) {
            const card = toggleButton.closest('.client-card');
            const toggleText = toggleButton.querySelector('span');
            const moreDetails = card.querySelector('.more-details');
            const direccionCompleta = card.querySelector('.direccion-completa');


            card.classList.toggle('open');
            if (card.classList.contains('open')) {
                toggleText.textContent = t('common.showLess');
                if(direccionCompleta) direccionCompleta.classList.remove('hidden');
            } else {
                toggleText.textContent = t('common.showMore');
                if(direccionCompleta) direccionCompleta.classList.add('hidden');
            }
        }
    });


    // --- INICIALIZACIÓN ---
    await loadProfileAndGreeting(); 
    await fetchClientes(); 
});