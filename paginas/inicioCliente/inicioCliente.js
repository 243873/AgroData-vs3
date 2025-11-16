document.addEventListener('DOMContentLoaded', async () => {
    // ===============================================
    // --- 1. CONFIGURACIÓN INICIAL Y VERIFICACIÓN DE SESIÓN ---
    // ===============================================
    
    // Asegúrate de que esto coincida con tu backend (7000)
    const API_BASE_URL = "http://localhost:7000"; 

    function getFechaLocalParaJava() {
        const date = new Date();
        
        // Función interna para asegurar dos dígitos (ej: 9 -> "09")
        const pad = (num) => String(num).padStart(2, '0');

        const YYYY = date.getFullYear();
        const MM = pad(date.getMonth() + 1); // getMonth() es 0-indexado
        const DD = pad(date.getDate());
        
        const HH = pad(date.getHours());
        const MIN = pad(date.getMinutes());
        const SS = pad(date.getSeconds());

        // Formato exacto requerido por @JsonFormat
        return `${YYYY}-${MM}-${DD}T${HH}:${MIN}:${SS}`;
    }

    // Obtenemos el usuario guardado en localStorage
    const authString = localStorage.getItem('usuarioActual');
    const usuarioActual = authString ? JSON.parse(authString) : null;

    // Validar el objeto de usuario
    if (!usuarioActual || !usuarioActual.id || !usuarioActual.rol || !usuarioActual.token) {
        console.error("No se encontró 'usuarioActual' o está incompleto. Redirigiendo a login.");
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/index.html';
        return;
    }
    
    const userId = usuarioActual.id;     
    const userRol = usuarioActual.rol;
    const authToken = usuarioActual.token; // <--- Token para la API

    console.log(`Usuario autenticado: ID ${userId}, Rol ${userRol}`);

    let currentUser = null;
    let catalogoCultivos = [];
    let catalogoTalleres = [];
    let catalogoRiego = [];

    
    // ===============================================
    // --- 2. FUNCIONES HELPER (API y Notificaciones) ---
    // ===============================================

    /**
     * Función 'fetch' personalizada que añade automáticamente el token
     * y las cabeceras necesarias.
     */
    async function fetchWithCors(url, options = {}) {
        // Preparar headers por defecto
        const defaultHeaders = {
            'Authorization': `Bearer ${authToken}`,
            'confirmado': 'true' // Requerido por algunas de tus rutas
        };

        // Si options.headers existe, fusionarlo con los headers por defecto
        let finalHeaders = defaultHeaders;
        if (options.headers && typeof options.headers === 'object') {
            finalHeaders = {
                ...defaultHeaders,
                ...options.headers
            };
        }

        // Crear las opciones finales
        const finalOptions = {
            ...options,
            headers: finalHeaders
        };

        console.log("Fetch request:", {
            url: url,
            method: finalOptions.method || 'GET',
            headers: finalHeaders
        });

        const response = await fetch(url, finalOptions);
        return response;
    }

    /**
     * Busca las notificaciones del agricultor desde la API.
     */
    async function fetchNotificaciones(token) {
        console.log("Cargando notificaciones...");
        try {
            // Usamos fetchWithCors para enviar el token automáticamente
            const response = await fetchWithCors(`${API_BASE_URL}/notificacionesagricultor`, {
                method: 'GET'
            });

            if (!response.ok) {
                console.error(`Error de API al cargar notificaciones: ${response.status} ${response.statusText}`);
                throw new Error('No se pudo conectar a la API de notificaciones');
            }

            const notificaciones = await response.json();
            console.log("Notificaciones recibidas:", notificaciones);
            return notificaciones;

        } catch (error) {
            console.error('Error fatal al cargar notificaciones:', error);
            return []; // Devuelve un array vacío en caso de error
        }
    }

    /**
     * Renderiza las notificaciones en el contenedor HTML (ID: notificationsList).
     */
    function renderNotificaciones(notificaciones) {
        const container = document.getElementById('notificationsList');
        if (!container) {
            console.warn('No se encontró #notificationsList en el DOM');
            return;
        }

        if (notificaciones.length === 0) {
            container.innerHTML = '<p class="empty-state">No tienes notificaciones pendientes.</p>';
            return;
        }

        container.innerHTML = ''; // Limpiar el contenedor
        
        notificaciones.forEach(notif => {
            const tipo = notif.tipoNotificacion;
            const estado = notif.nombreEstado;
            const id = notif.idNotificacion;
            
            let textoTipo = 'Notificación';
            let claseTipo = ''; // Para el estilo

            switch (tipo) {
                case 'asesoria': textoTipo = 'Asesoría'; claseTipo = 'type-asesoria'; break;
                case 'taller': textoTipo = 'Taller'; claseTipo = 'type-taller'; break;
                case 'tarea': textoTipo = 'Tarea'; claseTipo = 'type-tarea'; break;
            }

            const item = document.createElement('div');
            item.className = 'notification-item'; 
            item.setAttribute('data-id', id);

            // ⭐ ¡AQUÍ ESTÁ EL CAMBIO! (ID eliminado)
            item.innerHTML = `
                <div class="notification-text">
                    ¡Tu <strong>${textoTipo}</strong> ha cambiado de estado a: <strong>${estado}</strong>!
                </div>
                <div class="notification-actions">
                    <button class="btn btn-primary btn-goto" data-type="${tipo}" data-id="${id}">Ir a Solicitudes</button>
                    <button class="btn btn-danger btn-discard" data-id="${id}">Descartar</button>
                </div>
            `;
            container.appendChild(item);
        });
    }


    // ===============================================
    // --- 3. CARGA INICIAL DE DATOS ---
    // ===============================================
    
    try {
        console.log("Iniciando carga de datos...");
        
        // ⭐ Cargar perfil de usuario
        const responseUser = await fetch(`${API_BASE_URL}/perfil/${userId}`, {   
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            }
        });

        console.log("Response de perfil:", responseUser.status, responseUser.statusText);

        if (!responseUser.ok) {
            throw new Error(`Error de API al cargar perfil: ${responseUser.status} ${responseUser.statusText}`);
        }
        
        currentUser = await responseUser.json();
        currentUser.id = currentUser.idUsuario || userId;
        console.log("✓ Perfil de usuario cargado:", currentUser);

        // --- ¡NUEVO! Cargar Notificaciones ---
        const notificaciones = await fetchNotificaciones(authToken);
        renderNotificaciones(notificaciones);
        // --- Fin Carga Notificaciones ---

        // === CARGAR CATÁLOGOS ===
        await loadCatalogos();

    }  catch (error) {
        console.error('❌ Error en la inicialización:', error);
        // Si falla la carga inicial (ej. token expirado), redirigir
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/index.html';
        return;
    }

    // --- FUNCIÓN PARA CARGAR CATÁLOGOS ---
    async function loadCatalogos() {
        try {
            console.log("Cargando catálogos...");

            // Cargar Cultivos (API pública)
            const resCultivos = await fetch(`${API_BASE_URL}/catalogo/cultivos`);
            if (resCultivos.ok) {
                catalogoCultivos = await resCultivos.json();
                console.log("✓ Cultivos cargados:", catalogoCultivos.length);
                renderCultivosList(); // Renderiza en el form de asesoría
            }

            // Cargar Talleres (API protegida)
            // Usamos fetchWithCors para enviar el token
            const resTalleres = await fetchWithCors(`${API_BASE_URL}/talleres`, {
                method: 'GET'
            });
            if (resTalleres.ok) {
                catalogoTalleres = await resTalleres.json();
                console.log("✓ Talleres cargados:", catalogoTalleres.length);
            }

            // Cargar Tipos de Riego (API pública)
            const resRiego = await fetch(`${API_BASE_URL}/catalogo/tipoterreno`);
            if (resRiego.ok) {
                catalogoRiego = await resRiego.json();
                console.log("✓ Tipos de riego cargados:", catalogoRiego.length);
            }
            
        } catch (err) {
            console.error("Error general cargando catálogos:", err);
        }
    }

    /**
     * Renderiza la lista de cultivos para seleccionar en Asesorías
     */
    function renderCultivosList() {
        const container = document.querySelector('#asesoria-form-view .asesoria-selection-view .options-group');
        if (!container) {
            console.warn("No se encontró '.options-group' para renderizar cultivos.");
            return;
        }
        container.innerHTML = '';
        
        catalogoCultivos.forEach(cultivo => {
            container.innerHTML += `
                <div class="cultivo-option">
                    <input type="checkbox" name="cultivo-select" id="cultivo-${cultivo.idCultivo}" value="${cultivo.idCultivo}" data-nombre="${cultivo.nombreCultivo}">
                    <label for="cultivo-${cultivo.idCultivo}">${cultivo.nombreCultivo}</label>
                </div>
            `;
        });
    }

    // ===============================================
    // --- 4. ELEMENTOS DEL DOM Y LÓGICA DE VISTAS ---
    // ===============================================
    
    // Vistas principales
    const initialView = document.getElementById('initial-view');
    const asesoriaFormView = document.getElementById('asesoria-form-view');
    const talleresFlowView = document.getElementById('talleres-flow-view');
    
    // Mensaje de bienvenida
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    // Modales (ya definidos en HTML)
    const successModal = document.getElementById('successModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalAceptar = document.getElementById('modalAceptar');
    
    // Modal de Notificaciones (¡NUEVO!)
    const confirmationModal = document.getElementById('confirmationModal');
    const cancelDiscardBtn = document.getElementById('cancelDiscard');
    const confirmDiscardBtn = document.getElementById('confirmDiscard');
    const notificationsList = document.getElementById('notificationsList');
    let notificationToDiscard = null; // Para guardar la notificación a eliminar

    if (welcomeMessage && currentUser) {
        welcomeMessage.textContent = `Bienvenido, ${currentUser.nombre || 'Usuario'}`;
    }

    function showView(viewToShow) {
        [initialView, asesoriaFormView, talleresFlowView].forEach(v => {
            if (v) v.classList.add('hidden');
        });
        if (viewToShow) viewToShow.classList.remove('hidden');
    }

    // ===============================================
    // --- 5. LÓGICA PARA DESCARTAR NOTIFICACIONES ---
    // ===============================================
    
    // Escuchamos clics en la lista de notificaciones (definida en tu HTML)
    if (notificationsList) {
        notificationsList.addEventListener('click', (e) => {
            
            // ⭐ LÓGICA ACTUALIZADA PARA MANEJAR AMBOS BOTONES
            
            // 1. Handle "Descartar"
            if (e.target.classList.contains('btn-discard')) {
                notificationToDiscard = e.target.closest('.notification-item');
                if (confirmationModal) confirmationModal.classList.remove('hidden');
            }

            // 2. Handle "Ir a Solicitudes"
            else if (e.target.classList.contains('btn-goto')) {
                const button = e.target;
                const tipo = button.dataset.type;
                
                // Lógica de redirección
                console.log(`Redirigiendo a la sección: ${tipo}`);
                
                if (tipo === 'asesoria' || tipo === 'tarea') {
                    // Ambas van a la misma página (proyectos)
                    window.location.href = '/paginas/proyectoCliente/proyectos-lista.html'; 
                } else if (tipo === 'taller') {
                    // Taller va a su historial
                    window.location.href = '/paginas/talleresCliente/talleres-historial.html';
                } else {
                    // Fallback por si acaso
                    window.location.href = '/paginas/proyectoCliente/proyectos-lista.html';
                }
            }
        });
    }

    // Acción del botón "Cancelar" en el modal
    if (cancelDiscardBtn) {
        cancelDiscardBtn.addEventListener('click', () => {
            if (confirmationModal) confirmationModal.classList.add('hidden');
            notificationToDiscard = null;
        });
    }

    // Acción del botón "Confirmar Descartar" en el modal
    if (confirmDiscardBtn) {
        confirmDiscardBtn.addEventListener('click', () => {
            if (notificationToDiscard) {
                notificationToDiscard.remove(); // Elimina del DOM
                if (notificationsList.children.length === 0) {
                    notificationsList.innerHTML = '<p class="empty-state">No tienes notificaciones pendientes.</p>';
                }
            }
            if (confirmationModal) confirmationModal.classList.add('hidden');
            notificationToDiscard = null;
        });
    }

    // ===============================================
    // --- 6. LÓGICA DE ASESORÍAS (MODIFICADA) ---
    // ===============================================

    const showAsesoriaFormBtn = document.getElementById('show-asesoria-form');
    const asesoriaSelectionView = document.querySelector('#asesoria-form-view .asesoria-selection-view');
    const asesoriaFormDetailsView = document.querySelector('#asesoria-form-view .asesoria-form-details-view');
    const continueToAsesoriaFormBtn = document.querySelector('#asesoria-form-view .continue-to-form');
    const backToAsesoriaSelectionBtn = document.querySelector('#asesoria-form-view .back-to-selection');
    const asesoriaForm = document.querySelector('#asesoria-form-view .asesoriaForm');

    // Botón "Cancelar" (busca todos los que tengan esa clase)
    document.querySelectorAll('.cancel-flow').forEach(btn => {
        btn.addEventListener('click', () => showView(initialView));
    });

    let asesoriaSelectedCultivos = [];
    let singleAsesoriaFormData = {}; // Almacenará los datos del formulario único

    if (showAsesoriaFormBtn) {
        showAsesoriaFormBtn.addEventListener('click', () => {
            showView(asesoriaFormView);
            if (asesoriaSelectionView) asesoriaSelectionView.classList.remove('hidden');
            if (asesoriaFormDetailsView) asesoriaFormDetailsView.classList.add('hidden');
            renderCultivosList(); // Asegura que la lista de cultivos esté fresca
        });
    }

    if (continueToAsesoriaFormBtn) {
        continueToAsesoriaFormBtn.addEventListener('click', () => {
            const checkboxes = asesoriaSelectionView.querySelectorAll('input[name="cultivo-select"]:checked');
            
            asesoriaSelectedCultivos = Array.from(checkboxes).map(cb => ({
                id: parseInt(cb.value),
                nombre: cb.dataset.nombre 
            }));

            if (asesoriaSelectedCultivos.length === 0 || asesoriaSelectedCultivos.length > 3) {
                alert('Debes seleccionar entre 1 y 3 cultivos.');
                return;
            }
            
            // Llama a la nueva función de generación de formulario único
            generateSingleAsesoriaForm(asesoriaSelectedCultivos);

            asesoriaSelectionView.classList.add('hidden');
            asesoriaFormDetailsView.classList.remove('hidden');
        });
    }

    if (backToAsesoriaSelectionBtn) {
        backToAsesoriaSelectionBtn.addEventListener('click', () => {
            asesoriaFormDetailsView.classList.add('hidden');
            asesoriaSelectionView.classList.remove('hidden');
            
            // Limpieza del formulario único
            const formContentContainer = asesoriaForm.querySelector('#single-asesoria-form-content');
            if (formContentContainer) formContentContainer.innerHTML = '';
            singleAsesoriaFormData = {}; // Limpiar el almacén de datos
        });
    }
    
    /**
     * Genera la estructura de un formulario único para todos los cultivos seleccionados.
     */
    function generateSingleAsesoriaForm(selectedCultivos) {
        const formContentContainer = asesoriaFormDetailsView.querySelector('#single-asesoria-form-content');
        if (!formContentContainer) return;

        const riegoOptions = catalogoRiego.map(riego => 
            `<option value="${riego.idRiego}">${riego.nombreRiego}</option>`
        ).join('');

        const cultivosNombres = selectedCultivos.map(c => c.nombre).join(', ');
        
        // Actualiza el mensaje del encabezado
        const headerP = asesoriaFormDetailsView.querySelector('.form-header p');
        if(headerP) headerP.innerHTML = `Paso 2 de 2: Completa los detalles de tu solicitud para: <strong>${cultivosNombres}</strong>`;

        formContentContainer.innerHTML = createSingleAsesoriaFormFields(riegoOptions);
        
        // Inicializa el almacén de datos
        singleAsesoriaFormData = {
            superficie: '', ubicacion: '', tipoRiego: '',
            utilizaMaquinaria: 'No', maquinariaNombre: '',
            tienePlaga: 'No', plagaDescripcion: '', motivo: '',
            contacto: currentUser.telefono || ''
        };

        addAsesoriaInputListeners();
    }
    
    /**
     * Define los campos del formulario único.
     */
    function createSingleAsesoriaFormFields(riegoOptions) {
        return `
            <div class="form-grid">
                <div class="form-group">
                    <label for="superficie">Superficie Total (Hectáreas):</label>
                    <input type="number" step="0.01" min="0.01" id="superficie" placeholder="Ej: 5.5" required>
                </div>
                <div class="form-group">
                    <label for="ubicacion">Ubicación del Terreno:</label>
                    <input type="text" id="ubicacion" placeholder="Ej: San Cristóbal, Chiapas" required>
                </div>
                
                <div class="form-group">
                    <label for="tipoRiego">Tipo de Riego:</label>
                    <select id="tipoRiego" required>
                        <option value="">Seleccione...</option>
                        ${riegoOptions}
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label>¿Utiliza maquinaria?</label>
                <div class="options-group">
                    <label class="option-control"><input type="radio" name="maquinaria" value="Si" required><span class="visual"></span> Sí</label>
                    <label class="option-control"><input type="radio" name="maquinaria" value="No" checked><span class="visual"></span> No</label>
                </div>
            </div>
            <div id="maquinariaInfo" class="form-group hidden">
                <label for="maquinariaNombre">Nombre de la maquinaria:</label>
                <textarea id="maquinariaNombre"></textarea>
            </div>
            <div class="form-group">
                <label>¿Tiene alguna plaga registrada?</label>
                <div class="options-group">
                    <label class="option-control"><input type="radio" name="plaga" value="Si" required><span class="visual"></span> Sí</label>
                    <label class="option-control"><input type="radio" name="plaga" value="No" checked><span class="visual"></span> No</label>
                </div>
            </div>
            <div id="plagaInfo" class="form-group hidden">
                <label for="plagaDescripcion">Descripción de la plaga:</label>
                <textarea id="plagaDescripcion"></textarea>
            </div>
            <div class="form-group full-width">
                <label for="motivo">Motivo de la asesoría (General):</label>
                <textarea id="motivo" required></textarea>
            </div>
        `;
    }
    
    /**
     * Agrega los listeners de entrada para el formulario único.
     */
    function addAsesoriaInputListeners() {
        const formContent = asesoriaForm.querySelector('#single-asesoria-form-content');
        
        formContent.addEventListener('input', (e) => {
            const target = e.target;
            if (target.id) {
                singleAsesoriaFormData[target.id] = target.value;
            }
        });

        formContent.addEventListener('change', (e) => {
            const target = e.target;
            
            if (target.name === 'maquinaria') {
                const maquinariaInfo = document.getElementById('maquinariaInfo');
                if (maquinariaInfo) maquinariaInfo.classList.toggle('hidden', target.value !== 'Si');
                singleAsesoriaFormData.utilizaMaquinaria = target.value;
            }

            if (target.name === 'plaga') {
                const plagaInfo = document.getElementById('plagaInfo');
                if (plagaInfo) plagaInfo.classList.toggle('hidden', target.value !== 'Si');
                singleAsesoriaFormData.tienePlaga = target.value;
            }
            
            if (target.id === 'tipoRiego') {
                singleAsesoriaFormData.tipoRiego = target.value;
            }
        });
    }

    /**
     * Valida el formulario único.
     */
    function validateSingleAsesoriaForm() {
        let allValid = true;
        // Limpia todos los errores
        asesoriaForm.querySelectorAll('input, select, textarea').forEach(el => el.classList.remove('input-error'));

        const data = singleAsesoriaFormData;

        const superficieInput = document.getElementById('superficie');
        const ubicacionInput = document.getElementById('ubicacion');
        const motivoInput = document.getElementById('motivo');
        const riegoInput = document.getElementById('tipoRiego');
        const maquinariaRadio = asesoriaForm.querySelector('input[name="maquinaria"]:checked');
        const plagaRadio = asesoriaForm.querySelector('input[name="plaga"]:checked');
        const maquinariaDetalleInput = document.getElementById('maquinariaNombre');
        const plagaDetalleInput = document.getElementById('plagaDescripcion');
        
        // Validación de Superficie
        const isSuperficieValid = superficieInput && !isNaN(parseFloat(superficieInput.value)) && parseFloat(superficieInput.value) > 0;

        if (!isSuperficieValid) {
            if (superficieInput) superficieInput.classList.add('input-error'); allValid = false;
        }
        
        // Validación de Ubicación
        if (!ubicacionInput || !ubicacionInput.value.trim()) {
            if (ubicacionInput) ubicacionInput.classList.add('input-error'); allValid = false;
        }
        
        // Validación de Motivo
        if (!motivoInput || !motivoInput.value.trim()) {
            if (motivoInput) motivoInput.classList.add('input-error'); allValid = false;
        }
        
        // Validación de Tipo de Riego
        if (!riegoInput || !riegoInput.value.trim()) {
            if (riegoInput) riegoInput.classList.add('input-error'); allValid = false;
        }

        // Validación de Detalle de Maquinaria (si 'Si' está marcado)
        if (maquinariaRadio && maquinariaRadio.value === 'Si' && (!maquinariaDetalleInput || !maquinariaDetalleInput.value.trim())) {
            if (maquinariaDetalleInput) maquinariaDetalleInput.classList.add('input-error'); allValid = false;
        }
        // Validación de Detalle de Plaga (si 'Si' está marcado)
        if (plagaRadio && plagaRadio.value === 'Si' && (!plagaDetalleInput || !plagaDetalleInput.value.trim())) {
            if (plagaDetalleInput) plagaDetalleInput.classList.add('input-error'); allValid = false;
        }

        if (!allValid) {
            alert('Por favor, completa todos los campos obligatorios.');
        }
        return allValid;
    }


    if (asesoriaForm) {
        asesoriaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Llama a la nueva función de validación
            if (!validateSingleAsesoriaForm()) {
                return;
            }

            const data = singleAsesoriaFormData; // Usa los datos del formulario único

            const cultivosParaApi = asesoriaSelectedCultivos.map(cultivo => ({
                idCultivo: cultivo.id
            }));

            // El motivo de asesoría ahora incluye los nombres de los cultivos
            const cultivosNombres = asesoriaSelectedCultivos.map(c => c.nombre).join(', ');
            const motivoConCultivos = `Cultivos: ${cultivosNombres}. Motivo General: ${data.motivo}`;

            // Construcción del payload usando los datos unificados
            const solicitudAPIS = {
                idAgricultor: parseInt(currentUser.id),
                idEstado: 1, // 1 = Pendiente
                fechaSolicitud: getFechaLocalParaJava(),
                
                // Datos del formulario único
                superficieTotal: parseFloat(data.superficie),
                direccionTerreno: data.ubicacion,
                motivoAsesoria: motivoConCultivos, // Motivo modificado
                tipoRiego: parseInt(data.tipoRiego),

                // Variables booleanas
                usoMaquinaria: data.utilizaMaquinaria === 'Si',
                tienePlaga: data.tienePlaga === 'Si',

                // Campos condicionales
                nombreMaquinaria: (data.utilizaMaquinaria === 'Si') ? data.maquinariaNombre : null,
                descripcionPlaga: (data.tienePlaga === 'Si') ? data.plagaDescripcion : null,

                cultivos: cultivosParaApi
            };

            console.log("Enviando Payload de Asesoría:", JSON.stringify(solicitudAPIS, null, 2));

            try {
                const response = await fetchWithCors(`${API_BASE_URL}/solicitudasesoria`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(solicitudAPIS)
                });

                if (response.ok || response.status === 201) {
                    modalTitle.textContent = '¡Solicitud de Asesoría Enviada!';
                    modalMessage.textContent = 'Tu solicitud ha sido recibida. Un agrónomo se pondrá en contacto contigo.';
                } else {
                    const errorText = await response.text();
                    modalTitle.textContent = 'Error al Enviar Solicitud';
                    modalMessage.textContent = `Hubo un error en la API: ${errorText || response.statusText}.`;
                }

            } catch (error) {
                console.error('Error de red al enviar solicitud de asesoría:', error);
                modalTitle.textContent = 'Error de Conexión';
                modalMessage.textContent = 'No se pudo conectar con el servidor. (Probable error de CORS)';
            }

            if(successModal) successModal.classList.remove('hidden');
        });
    }

    // ===============================================
    // --- 7. LÓGICA DE TALLERES ---
    // ===============================================

    const showTalleresFlowBtn = document.getElementById('show-talleres-flow');
    const tallerSelectionView = document.getElementById('taller-selection-view');
    const tallerFormView = document.getElementById('taller-form-view');
    const talleresListContainer = document.getElementById('talleres-list-container');
    const continueToTallerFormBtn = document.getElementById('continueToTallerFormBtn');
    const btnCancelTaller = document.getElementById('btnCancelTaller');
    const btnBackToTallerSelection = document.getElementById('btnBackToTallerSelection');
    const tallerSolicitudForm = document.getElementById('tallerSolicitudForm');

    let selectedTalleres = [];

    function renderTalleresList() {
        if (!talleresListContainer) return;

        talleresListContainer.innerHTML = '';
        catalogoTalleres.forEach(taller => {
            const wrapper = document.createElement('div');
            wrapper.className = 'taller-card';
            wrapper.innerHTML = `
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="taller-${taller.idTaller}" data-id="${taller.idTaller}" class="taller-checkbox">
                    <label for="taller-${taller.idTaller}"></label>
                </div>
                <div class="taller-info">
                    <h4>${taller.nombreTaller}</h4> 
                    <p>${taller.descripcion}</p>
                    <span>Costo: $${taller.costo ? taller.costo.toLocaleString() : 'N/A'}</span>
                </div>
            `;
            talleresListContainer.appendChild(wrapper);
        });
    }

    function openTalleresFlow() {
        renderTalleresList(); // Asegura que la lista de talleres esté fresca
        showView(talleresFlowView);
        if (tallerSelectionView) tallerSelectionView.classList.remove('hidden');
        if (tallerFormView) tallerFormView.classList.add('hidden');
    }

    if (showTalleresFlowBtn) {
        showTalleresFlowBtn.addEventListener('click', openTalleresFlow);
    }

    if (btnCancelTaller) {
        btnCancelTaller.addEventListener('click', () => showView(initialView));
    }

    if (continueToTallerFormBtn) {
        continueToTallerFormBtn.addEventListener('click', () => {
            const ids = Array.from(document.querySelectorAll('.taller-checkbox:checked')).map(cb => cb.dataset.id);
            if (ids.length === 0) {
                alert('Por favor, selecciona al menos un taller.');
                return;
            }

            selectedTalleres = catalogoTalleres.filter(t => ids.includes(String(t.idTaller)));

            const listaContainer = document.getElementById('talleres-seleccionados-lista');
            const montoTotalEl = document.getElementById('montoTotal');
            let montoTotal = 0;
            if (listaContainer) listaContainer.innerHTML = '';

            selectedTalleres.forEach(taller => {
                if (listaContainer) listaContainer.innerHTML += `<div class="taller-resumen-item">✔️ ${taller.nombreTaller}</div>`;
                montoTotal += taller.costo;
            });

            if (montoTotalEl) montoTotalEl.textContent = `Monto Total: $${montoTotal.toLocaleString()}`;

            if (tallerSelectionView) tallerSelectionView.classList.add('hidden');
            if (tallerFormView) tallerFormView.classList.remove('hidden');
        });
    }

    if (btnBackToTallerSelection) {
        btnBackToTallerSelection.addEventListener('click', () => {
            if (tallerFormView) tallerFormView.classList.add('hidden');
            if (tallerSelectionView) tallerSelectionView.classList.remove('hidden');
        });
    }

    if (tallerSolicitudForm) {
        tallerSolicitudForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fechaInput = document.getElementById('fecha');
            const direccionInput = document.getElementById('ubicacion');
            const comentariosInput = document.getElementById('comentarios'); // Es opcional

            if (!fechaInput.value || !direccionInput.value) {
                alert('Por favor, complete todos los campos (Fecha y Ubicación).');
                return;
            }
            if (selectedTalleres.length === 0) {
                alert('Error: no hay talleres seleccionados.');
                return;
            }

            let exitos = 0;
            let fallos = 0;

            for (const taller of selectedTalleres) {
                
                const solicitudAPIS = {
                    idAgricultor: parseInt(currentUser.id),
                    idTaller: taller.idTaller,
                    
                    direccion: direccionInput.value,
                    comentario: comentariosInput ? comentariosInput.value : '',
                    
                    fechaAplicarTaller: fechaInput.value,
                    //fechaSolicitud: new Date().toISOString(),
                    fechaSolicitud: getFechaLocalParaJava(),
                    
                    idEstado: 1, // 1 = Pendiente
                    estadoPagoImagen: null,
                    fechaFin: null,
                };

                try {
                    // Usamos fetchWithCors para enviar la solicitud
                    const response = await fetchWithCors(`${API_BASE_URL}/solicitudtaller`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(solicitudAPIS)
                    });

                    if (response.ok || response.status === 201) {
                        exitos++;
                    } else {
                        fallos++;
                        console.error(`Error al enviar taller ${taller.nombreTaller}:`, await response.text());
                    }

                } catch (error) {
                    fallos++;
                    console.error(`Error de red al enviar taller ${taller.nombreTaller}:`, error);
                }
            }

            if (fallos === 0) {
                modalTitle.textContent = '¡Solicitudes Enviadas!';
                modalMessage.textContent = `Se enviaron ${exitos} solicitudes de taller correctamente.`;
            } else if (exitos > 0) {
                modalTitle.textContent = 'Solicitud Parcialmente Exitosa';
                modalMessage.textContent = `Se enviaron ${exitos} solicitudes, pero ${fallos} fallaron.`;
            } else {
                modalTitle.textContent = 'Error al Enviar Solicitudes';
                modalMessage.textContent = 'No se pudo enviar ninguna solicitud. (Probable error de CORS).';
            }
            
            if(successModal) successModal.classList.remove('hidden');
        });
    }

    // ===============================================
    // --- 8. LÓGICA DE MODALES Y NAVEGACIÓN ---
    // ===============================================

    // Modal de Aceptar (para flujos de Asesoría y Taller)
    if (modalAceptar) {
        modalAceptar.addEventListener('click', () => {
            if(successModal) successModal.classList.add('hidden');
            showView(initialView); // Regresa al inicio después de aceptar
            
            // Limpia los formularios
            if (asesoriaForm) asesoriaForm.reset();
            if (tallerSolicitudForm) tallerSolicitudForm.reset();
        });
    }

    // Navegación principal
    const navInicioLink = document.getElementById('nav-link-inicio');
    if (navInicioLink) {
        navInicioLink.addEventListener('click', (e) => {
            e.preventDefault();
            showView(initialView);
        });
    }

    // --- INICIALIZACIÓN DE LA VISTA ---
    showView(initialView);
});