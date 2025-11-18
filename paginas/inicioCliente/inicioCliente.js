document.addEventListener('DOMContentLoaded', async () => {

    function getFechaLocalParaJava() {
        const date = new Date();
        const pad = (num) => String(num).padStart(2, '0');
        const YYYY = date.getFullYear();
        const MM = pad(date.getMonth() + 1); 
        const DD = pad(date.getDate());
        const HH = pad(date.getHours());
        const MIN = pad(date.getMinutes());
        const SS = pad(date.getSeconds());
        return `${YYYY}-${MM}-${DD}T${HH}:${MIN}:${SS}`;
    }
    
    /**
     * Devuelve la fecha de hoy en formato 'YYYY-MM-DD' (ISO local)
     */
    function getTodayString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const authString = localStorage.getItem('usuarioActual');
    const usuarioActual = authString ? JSON.parse(authString) : null;

    if (!usuarioActual || !usuarioActual.id || !usuarioActual.rol || !usuarioActual.token) {
        console.error("No se encontró 'usuarioActual' o está incompleto. Redirigiendo a login.");
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/index.html';
        return;
    }
    
    const userId = usuarioActual.id;     
    const userRol = usuarioActual.rol;
    const authToken = usuarioActual.token; 

    console.log(`Usuario autenticado: ID ${userId}, Rol ${userRol}`);

    let currentUser = null;
    let catalogoCultivos = [];
    let catalogoTalleres = [];
    let catalogoRiego = [];

    
    // ===============================================
    // --- 2. FUNCIONES HELPER (API y Notificaciones) ---
    // ===============================================

    async function fetchWithCors(url, options = {}) {
        const defaultHeaders = {
            'Authorization': `Bearer ${authToken}`,
            'confirmado': 'true' 
        };
        let finalHeaders = defaultHeaders;
        if (options.headers && typeof options.headers === 'object') {
            finalHeaders = { ...defaultHeaders, ...options.headers };
        }
        const finalOptions = { ...options, headers: finalHeaders };
        const response = await fetch(url, finalOptions);
        return response;
    }

    async function fetchNotificaciones(token) {
        console.log("Cargando notificaciones...");
        try {
            const response = await fetchWithCors(`${API_BASE_URL}/notificacionesagricultor`, { method: 'GET' });
            if (!response.ok) {
                console.error(`Error de API al cargar notificaciones: ${response.status} ${response.statusText}`);
                throw new Error('No se pudo conectar a la API de notificaciones');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fatal al cargar notificaciones:', error);
            return []; 
        }
    }

    function renderNotificaciones(notificaciones) {
        const container = document.getElementById('notificationsList');
        if (!container) return;

        if (notificaciones.length === 0) {
            container.innerHTML = `<p class="empty-state">${t('clientDash.noPendingNotifications')}</p>`;
            return;
        }

        container.innerHTML = ''; 
        notificaciones.forEach(notif => {
            const tipo = notif.tipoNotificacion;
            const estado = notif.nombreEstado;
            const id = notif.idNotificacion;
            let textoTipo = 'Notificación';

            switch (tipo) {
                case 'asesoria': textoTipo = t('service.advisory'); break;
                case 'taller': textoTipo = t('service.workshop'); break;
                case 'tarea': textoTipo = t('service.task'); break;
                default: textoTipo = t('common.notification'); break;
            }

            const item = document.createElement('div');
            item.className = 'notification-item'; 
            item.setAttribute('data-id', id);

            item.innerHTML = `
                <div class="notification-text">
                    ${t('clientDash.notificationPrefix')} <strong>${textoTipo}</strong> ${t('clientDash.notificationChanged')} <strong>${estado}</strong>!
                </div>
                <div class="notification-actions">
                    <button class="btn btn-primary btn-goto" data-type="${tipo}" data-id="${id}">${t('clientDash.goToRequests')}</button>
                    <button class="btn btn-danger btn-discard" data-id="${id}">${t('clientDash.discard')}</button>
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
        const responseUser = await fetch(`${API_BASE_URL}/perfil/${userId}`, {   
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
        });

        if (!responseUser.ok) throw new Error(`Error de API al cargar perfil: ${responseUser.status}`);
        
        currentUser = await responseUser.json();
        currentUser.id = currentUser.idUsuario || userId;

        const notificaciones = await fetchNotificaciones(authToken);
        renderNotificaciones(notificaciones);
        await loadCatalogos();

    }  catch (error) {
        console.error('❌ Error en la inicialización:', error);
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/index.html';
        return;
    }

    async function loadCatalogos() {
        try {
            const resCultivos = await fetch(`${API_BASE_URL}/catalogo/cultivos`);
            if (resCultivos.ok) {
                catalogoCultivos = await resCultivos.json();
                renderCultivosList(); 
            }
            const resTalleres = await fetchWithCors(`${API_BASE_URL}/talleres`, { method: 'GET' });
            if (resTalleres.ok) catalogoTalleres = await resTalleres.json();

            const resRiego = await fetch(`${API_BASE_URL}/catalogo/tipoterreno`);
            if (resRiego.ok) catalogoRiego = await resRiego.json();
            
        } catch (err) {
            console.error("Error general cargando catálogos:", err);
        }
    }

    function renderCultivosList() {
        const container = document.querySelector('#asesoria-form-view .asesoria-selection-view .options-group');
        if (!container) return;
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
    
    const initialView = document.getElementById('initial-view');
    const asesoriaFormView = document.getElementById('asesoria-form-view');
    const talleresFlowView = document.getElementById('talleres-flow-view');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const successModal = document.getElementById('successModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalAceptar = document.getElementById('modalAceptar');
    const confirmationModal = document.getElementById('confirmationModal');
    const cancelDiscardBtn = document.getElementById('cancelDiscard');
    const confirmDiscardBtn = document.getElementById('confirmDiscard');
    const notificationsList = document.getElementById('notificationsList');
    let notificationToDiscard = null; 

    if (welcomeMessage && currentUser) {
        welcomeMessage.textContent = `${t('common.welcome')}, ${currentUser.nombre || t('common.user')}`;
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
    
    if (notificationsList) {
        notificationsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-discard')) {
                notificationToDiscard = e.target.closest('.notification-item');
                if (confirmationModal) confirmationModal.classList.remove('hidden');
            }
            else if (e.target.classList.contains('btn-goto')) {
                const button = e.target;
                const tipo = button.dataset.type;
                
                if (tipo === 'asesoria' || tipo === 'tarea') {
                    window.location.href = '/paginas/proyectoCliente/proyectos-lista.html'; 
                } else if (tipo === 'taller') {
                    window.location.href = '/paginas/talleresCliente/talleres-historial.html';
                } else {
                    window.location.href = '/paginas/proyectoCliente/proyectos-lista.html';
                }
            }
        });
    }

    if (cancelDiscardBtn) {
        cancelDiscardBtn.addEventListener('click', () => {
            if (confirmationModal) confirmationModal.classList.add('hidden');
            notificationToDiscard = null;
        });
    }

    if (confirmDiscardBtn) {
        confirmDiscardBtn.addEventListener('click', () => {
            if (notificationToDiscard) {
                notificationToDiscard.remove(); 
                if (notificationsList.children.length === 0) {
                    notificationsList.innerHTML = `<p class="empty-state">${t('clientDash.noPendingNotifications')}</p>`;
                }
            }
            if (confirmationModal) confirmationModal.classList.add('hidden');
            notificationToDiscard = null;
        });
    }

    // ===============================================
    // --- 6. LÓGICA DE ASESORÍAS ---
    // ===============================================

    const showAsesoriaFormBtn = document.getElementById('show-asesoria-form');
    const asesoriaSelectionView = document.querySelector('#asesoria-form-view .asesoria-selection-view');
    const asesoriaFormDetailsView = document.querySelector('#asesoria-form-view .asesoria-form-details-view');
    const continueToAsesoriaFormBtn = document.querySelector('#asesoria-form-view .continue-to-form');
    const backToAsesoriaSelectionBtn = document.querySelector('#asesoria-form-view .back-to-selection');
    const asesoriaForm = document.querySelector('#asesoria-form-view .asesoriaForm');

    document.querySelectorAll('.cancel-flow').forEach(btn => {
        btn.addEventListener('click', () => showView(initialView));
    });

    let asesoriaSelectedCultivos = [];
    let singleAsesoriaFormData = {}; 

    if (showAsesoriaFormBtn) {
        showAsesoriaFormBtn.addEventListener('click', () => {
            showView(asesoriaFormView);
            if (asesoriaSelectionView) asesoriaSelectionView.classList.remove('hidden');
            if (asesoriaFormDetailsView) asesoriaFormDetailsView.classList.add('hidden');
            renderCultivosList(); 
        });
    }

    if (continueToAsesoriaFormBtn) {
        continueToAsesoriaFormBtn.addEventListener('click', () => {
            const checkboxes = asesoriaSelectionView.querySelectorAll('input[name="cultivo-select"]:checked');
            asesoriaSelectedCultivos = Array.from(checkboxes).map(cb => ({ id: parseInt(cb.value), nombre: cb.dataset.nombre }));

            if (asesoriaSelectedCultivos.length === 0 || asesoriaSelectedCultivos.length > 3) {
                alert(t('clientDash.selectCrops'));
                return;
            }
            generateSingleAsesoriaForm(asesoriaSelectedCultivos);
            asesoriaSelectionView.classList.add('hidden');
            asesoriaFormDetailsView.classList.remove('hidden');
        });
    }

    if (backToAsesoriaSelectionBtn) {
        backToAsesoriaSelectionBtn.addEventListener('click', () => {
            asesoriaFormDetailsView.classList.add('hidden');
            asesoriaSelectionView.classList.remove('hidden');
            const formContentContainer = asesoriaForm.querySelector('#single-asesoria-form-content');
            if (formContentContainer) formContentContainer.innerHTML = '';
            singleAsesoriaFormData = {}; 
        });
    }
    
    function generateSingleAsesoriaForm(selectedCultivos) {
        const formContentContainer = asesoriaFormDetailsView.querySelector('#single-asesoria-form-content');
        if (!formContentContainer) return;

        const riegoOptions = catalogoRiego.map(riego => `<option value="${riego.idRiego}">${riego.nombreRiego}</option>`).join('');
        const cultivosNombres = selectedCultivos.map(c => c.nombre).join(', ');
        const headerP = asesoriaFormDetailsView.querySelector('.form-header p');
        if(headerP) headerP.innerHTML = `Paso 2 de 2: Completa los detalles de tu solicitud para: <strong>${cultivosNombres}</strong>`;

        formContentContainer.innerHTML = createSingleAsesoriaFormFields(riegoOptions);
        singleAsesoriaFormData = {
            superficie: '', ubicacion: '', tipoRiego: '',
            utilizaMaquinaria: 'No', maquinariaNombre: '',
            tienePlaga: 'No', plagaDescripcion: '', motivo: '',
            contacto: currentUser.telefono || ''
        };
        addAsesoriaInputListeners();
    }
    
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
    
    function addAsesoriaInputListeners() {
        const formContent = asesoriaForm.querySelector('#single-asesoria-form-content');
        formContent.addEventListener('input', (e) => {
            const target = e.target;
            if (target.id) singleAsesoriaFormData[target.id] = target.value;
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
            if (target.id === 'tipoRiego') singleAsesoriaFormData.tipoRiego = target.value;
        });
    }

    function validateSingleAsesoriaForm() {
        let allValid = true;
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
        
        const isSuperficieValid = superficieInput && !isNaN(parseFloat(superficieInput.value)) && parseFloat(superficieInput.value) > 0;

        if (!isSuperficieValid) { if (superficieInput) superficieInput.classList.add('input-error'); allValid = false; }
        if (!ubicacionInput || !ubicacionInput.value.trim()) { if (ubicacionInput) ubicacionInput.classList.add('input-error'); allValid = false; }
        if (!motivoInput || !motivoInput.value.trim()) { if (motivoInput) motivoInput.classList.add('input-error'); allValid = false; }
        if (!riegoInput || !riegoInput.value.trim()) { if (riegoInput) riegoInput.classList.add('input-error'); allValid = false; }

        if (maquinariaRadio && maquinariaRadio.value === 'Si' && (!maquinariaDetalleInput || !maquinariaDetalleInput.value.trim())) {
            if (maquinariaDetalleInput) maquinariaDetalleInput.classList.add('input-error'); allValid = false;
        }
        if (plagaRadio && plagaRadio.value === 'Si' && (!plagaDetalleInput || !plagaDetalleInput.value.trim())) {
            if (plagaDetalleInput) plagaDetalleInput.classList.add('input-error'); allValid = false;
        }

        if (!allValid) alert(t('clientDash.completeFields'));
        return allValid;
    }


    if (asesoriaForm) {
        asesoriaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateSingleAsesoriaForm()) return;

            const data = singleAsesoriaFormData; 
            const cultivosParaApi = asesoriaSelectedCultivos.map(cultivo => ({ idCultivo: cultivo.id }));
            const cultivosNombres = asesoriaSelectedCultivos.map(c => c.nombre).join(', ');
            const motivoConCultivos = `Cultivos: ${cultivosNombres}. Motivo General: ${data.motivo}`;

            const solicitudAPIS = {
                idAgricultor: parseInt(currentUser.id),
                idEstado: 1, 
                fechaSolicitud: getFechaLocalParaJava(),
                superficieTotal: parseFloat(data.superficie),
                direccionTerreno: data.ubicacion,
                motivoAsesoria: motivoConCultivos,
                tipoRiego: parseInt(data.tipoRiego),
                usoMaquinaria: data.utilizaMaquinaria === 'Si',
                tienePlaga: data.tienePlaga === 'Si',
                nombreMaquinaria: (data.utilizaMaquinaria === 'Si') ? data.maquinariaNombre : null,
                descripcionPlaga: (data.tienePlaga === 'Si') ? data.plagaDescripcion : null,
                cultivos: cultivosParaApi
            };

            try {
                const response = await fetchWithCors(`${API_BASE_URL}/solicitudasesoria`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(solicitudAPIS)
                });

                if (response.ok || response.status === 201) {
                    modalTitle.textContent = t('clientDash.advisoryRequestSent');
                    modalMessage.textContent = t('clientDash.advisoryRequestMsg');
                } else {
                    const errorText = await response.text();
                    modalTitle.textContent = t('clientDash.sendRequestError');
                    modalMessage.textContent = `Hubo un error en la API: ${errorText || response.statusText}.`;
                }
            } catch (error) {
                console.error('Error de red:', error);
                modalTitle.textContent = t('clientDash.connectionError');
                modalMessage.textContent = t('clientDash.connectionErrorMsg');
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
        renderTalleresList(); 
        showView(talleresFlowView);
        if (tallerSelectionView) tallerSelectionView.classList.remove('hidden');
        if (tallerFormView) tallerFormView.classList.add('hidden');

        // --- Configurar fecha mínima ---
        try {
            document.getElementById('fecha').min = getTodayString();
        } catch (e) {
            console.warn("No se pudo setear la fecha mínima para el taller.");
        }
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
                alert(t('clientDash.selectWorkshop'));
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

            if (montoTotalEl) montoTotalEl.textContent = `${t('clientDash.totalAmount')} $${montoTotal.toLocaleString()}`;

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
            const comentariosInput = document.getElementById('comentarios'); 
            const today = getTodayString();

            if (!fechaInput.value || !direccionInput.value) {
                alert(t('clientDash.completeFieldsWorkshop'));
                return;
            }
            
            // --- Validación de Fecha ---
            if (fechaInput.value < today) {
                alert(t('clientDash.invalidWorkshopDate'));
                return;
            }

            if (selectedTalleres.length === 0) {
                alert(t('clientDash.noWorkshopsSelected'));
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
                    fechaSolicitud: getFechaLocalParaJava(),
                    idEstado: 1,
                    estadoPagoImagen: null,
                    fechaFin: null,
                };

                try {
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
                modalTitle.textContent = t('clientDash.requestsSent');
                modalMessage.textContent = t('clientDash.requestsSentSuccess').replace('{count}', exitos);
            } else if (exitos > 0) {
                modalTitle.textContent = t('clientDash.partialSuccess');
                modalMessage.textContent = t('clientDash.partialSuccessMsg').replace('{success}', exitos).replace('{failed}', fallos);
            } else {
                modalTitle.textContent = t('clientDash.sendError');
                modalMessage.textContent = t('clientDash.sendErrorMsg');
            }
            
            if(successModal) successModal.classList.remove('hidden');
        });
    }

    // ===============================================
    // --- 8. LÓGICA DE MODALES Y NAVEGACIÓN ---
    // ===============================================

    if (modalAceptar) {
        modalAceptar.addEventListener('click', () => {
            if(successModal) successModal.classList.add('hidden');
            showView(initialView);
            if (asesoriaForm) asesoriaForm.reset();
            if (tallerSolicitudForm) tallerSolicitudForm.reset();
        });
    }

    const navInicioLink = document.getElementById('nav-link-inicio');
    if (navInicioLink) {
        navInicioLink.addEventListener('click', (e) => {
            e.preventDefault();
            showView(initialView);
        });
    }

    showView(initialView);
});