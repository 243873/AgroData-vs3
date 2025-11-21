document.addEventListener('DOMContentLoaded', async () => {
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual'));
    let clientesData = [];
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


    async function fetchWithAuth(url, options = {}) {
        try {
            const headers = {
                'Authorization': `Bearer ${authToken}`,
                ...(options.headers || {})
            };
            const finalOptions = { ...options, headers };
            return await fetch(url, finalOptions);
        }catch (error){
            return Promise.reject(error);
        }

    }

    async function loadProfileAndGreeting() {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/perfil/${authInfo.id}`, { method: 'GET' });

            if (response.ok) {
                const user = await response.json();
                if (welcomeMessage) {
                    // ✅ CORRECCIÓN 1: Saludo dinámico exitoso
                    welcomeMessage.textContent = `${t('greeting.welcome')}, ${user.nombre}`;
                    authInfo.nombre = user.nombre;
                    localStorage.setItem('usuarioActual', JSON.stringify(authInfo));
                }
            } else {
                // ✅ CORRECCIÓN 2: Saludo por defecto si el fetch falla (status != 200)
                if (welcomeMessage) welcomeMessage.textContent = `${t('greeting.welcome')}, ${t('common.agronomist')}`;
            }
        } catch (error) {
            console.error('Error al cargar datos de perfil para el saludo:', error);
            // ✅ CORRECCIÓN 3: Saludo por defecto si el fetch falla (excepción)
            if (welcomeMessage) welcomeMessage.textContent = `${t('greeting.welcome')}, ${t('common.agronomist')}`;
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
            const card = document.createElement('tr');
            card.innerHTML = `
                 <td>${cliente.idUsuario}</td>
                 <td>${fullName}</td>
                 <td>${cliente.correo}</td>
                 <td>${cliente.telefono}</td>
                 <td data-actions>
                     <button class="btn btn-delete" onclick="eliminarCliente(${cliente.idUsuario})">Eliminar</button>
                     <button class="btn btn-edit" data-id="${cliente.idUsuario}">${t('common.edit')}</button>
                 </td>
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
            const response = await fetchWithAuth(`${API_BASE_URL}/administrarClientes`, { method: 'GET' });

            if (!response.ok) {
                // Si falla, muestra un mensaje amigable, no el error crudo.
                clientGrid.innerHTML = `<p class="error-message">${t('client.loadError')}</p>`;
                clientCountElement.textContent = t('client.loadingError');
                return;
            }

            clientesData = await response.json();
            renderClientes(clientesData);

        } catch (error) {
            console.error('Error al obtener la lista de clientes:', error);
            clientGrid.innerHTML = `<p class="error-message">${t('client.connectionError')}</p>`;
            clientCountElement.textContent = t('client.loadingError');
        }
    }
    window.eliminarCliente = async function eliminarCliente(idUsuario) {
        try {
            if (confirm("¿Seguro que deseas eliminar este cliente?")) {
                const response = await fetchWithAuth(
                    `${API_BASE_URL}/administrarClientes/${idUsuario}`,
                    { method: 'DELETE' }
                );

                if (!response.ok) {
                    // Error HTTP (400, 404, 500, etc.)
                    const errorText = await response.text();
                    throw new Error(errorText || "Error al eliminar cliente");
                }
                await fetchClientes();
                // Éxito
                window.alert("Cliente eliminado correctamente");
            }
        } catch (error) {
            // Error de red o excepción inesperada
            window.alert("Ocurrió un error al intentar eliminar el cliente, contiene información en el sistema");
            console.error("Error en eliminarCliente:", error);
        }
    };
    const openModalFunc = (m) => m.classList.remove('hidden');
    const closeModalFunc = (m) => m.classList.add('hidden');
    const modal = document.getElementById('ClienteModal');
    const clienteForm = document.getElementById('clienteForm');

    clientGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-edit');
        if (btn) {
            let clienteId = parseInt(btn.dataset.id);
            openModalFunc(modal);
            const cliente = clientesData.find(value => value.idUsuario === clienteId);
            if (cliente) {
                clienteForm.elements['idCliente'].value = cliente.idUsuario;
                clienteForm.elements['clienteNombre'].value = cliente.nombre;
                clienteForm.elements['clienteApellidoPaterno'].value = cliente.apellidoMaterno;
                clienteForm.elements['clienteApellidoMaterno'].value = cliente.apellidoPaterno;
                clienteForm.elements['clienteCorreo'].value = cliente.correo;
                clienteForm.elements['clienteTelefono'].value = cliente.telefono;

                document.getElementById('modalTitle').textContent = t('workshop.editTitle');
                document.getElementById('deleteWorkshopBtn').classList.remove('hidden');
                openModalFunc(modal);
            }
        }
    });

    document.getElementById('cancelCliente').addEventListener('click', () => closeModalFunc(modal));

    window.saveClienteFuntion = async function saveClienteFuntion (){
        const cliente ={
            idUsuario: document.getElementById('idCliente').value,
            nombre: document.getElementById('clienteNombre').value,
            apellidoPaterno: document.getElementById('clienteApellidoPaterno').value,
            apellidoMaterno: document.getElementById('clienteApellidoMaterno').value,
            correo: document.getElementById('clienteCorreo').value,
            telefono: document.getElementById('clienteTelefono').value,
        }
        try {
            const response = await fetchWithAuth(
                `${API_BASE_URL}/administrarClientes/${cliente.idUsuario}`,
                { method: 'PUT', body:JSON.stringify(cliente) }
            );

            if (!response.ok) {
                // Error HTTP (400, 404, 500, etc.)
                const errorText = await response.text();
                throw new Error(errorText || "Error al eliminar cliente");
            }
            closeModalFunc(modal)
            await fetchClientes();
            // Éxito
            window.alert("Cliente actualizado correctamente");
        } catch (e){
            console.error(e)
            window.alert("Error al actualizar");

        }
    }

    // --- INICIALIZACIÓN ---
    await loadProfileAndGreeting();
    await fetchClientes();
});