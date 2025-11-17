document.addEventListener('DOMContentLoaded', () => {

    // --- OBTENER ELEMENTOS DEL DOM ---
    const editButton = document.getElementById('editButton');
    const saveButton = document.getElementById('saveButton');
    const cancelButton = document.getElementById('cancelButton');
    const logoutButton = document.getElementById('logoutButton');
    const uploadButton = document.getElementById('uploadButton');
    const imageInput = document.getElementById('imageInput');
    const profileImage = document.getElementById('profileImage');
    
    const successModal = document.getElementById('successModal');
    const logoutModal = document.getElementById('logoutModal');
    const cancelLogoutBtn = document.getElementById('cancelLogout');
    const acceptLogoutBtn = document.getElementById('acceptLogout');

    const welcomeMessage = document.getElementById('welcomeMessage');

    const viewModeElements = document.querySelectorAll('.view-mode');
    const editModeElements = document.querySelectorAll('.edit-mode');

    const userTitleView = document.getElementById('userTitleView');
    const viewCorreo = document.getElementById('viewCorreo');
    const viewTelefono = document.getElementById('viewTelefono');

    // --- ** CAMPOS DE EDICIÓN DEL NUEVO FORMULARIO ** ---
    const editNombre = document.getElementById('editNombre');
    const editApellidoPaterno = document.getElementById('editApellidoPaterno'); 
    const editApellidoMaterno = document.getElementById('editApellidoMaterno'); 
    const emailInput = document.getElementById('emailInput');
    const contactInput = document.getElementById('contactInput');

    // --- ESTADO DE LA APLICACIÓN ---
    // Usamos el 'usuarioActual' que guardó tu script de login
    const authInfo = JSON.parse(localStorage.getItem('usuarioActual')); 
    const RUTA_IMAGEN_PREDEFINIDA = "/Imagenes/perfil.png"; 
    
    let fullUserData = null;
    let originalUserData = {};
    let newProfilePicBase64 = null;

    // --- LÓGICA PRINCIPAL ---

    if (!authInfo || !authInfo.id || !authInfo.token) {
        alert("No se ha iniciado sesión o la sesión es inválida. Redirigiendo...");
        window.location.href = '../../index.html';
        return;
    }

    /**
     * Función SÍNCRONA para poblar el DOM con un objeto de datos.
     */
    const populateDOM = (data) => {
        welcomeMessage.textContent = `Bienvenido, ${data.nombre}`;
        
        const fullName = `${data.nombre} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim();
        userTitleView.textContent = fullName;
        
        viewCorreo.textContent = data.correo;
        viewTelefono.textContent = data.telefono;
        
        // Lógica de imagen (correcta)
        if (data.imagenPerfil && data.imagenPerfil.trim() !== '' && data.imagenPerfil.trim() !== 'default.jpg') {
            profileImage.src = data.imagenPerfil;
        } else {
            profileImage.src = RUTA_IMAGEN_PREDEFINIDA;
        }
        
        // --- ** POBLAR LOS 5 CAMPOS DE EDICIÓN ** ---
        editNombre.value = data.nombre || '';
        editApellidoPaterno.value = data.apellidoPaterno || '';
        editApellidoMaterno.value = data.apellidoMaterno || '';
        emailInput.value = data.correo;
        contactInput.value = data.telefono;
    };

    /**
     * Carga los datos del usuario desde el backend (GET /perfil/{id})
     */
    const loadUserData = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/perfil/${authInfo.id}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authInfo.token}` }
            });

            if (response.status === 401 || response.status === 403) {
                throw new Error('Sesión inválida o expirada. Por favor, inicie sesión de nuevo.');
            }
            if (!response.ok) {
                throw new Error(`Error al cargar el perfil: ${response.statusText}`);
            }

            const data = await response.json();
            
            fullUserData = data;
            originalUserData = { ...data }; 

            populateDOM(data);
            
        } catch (error) {
            console.error('Error en loadUserData:', error);
            alert(error.message);
            localStorage.removeItem('usuarioActual');
            window.location.href = '../../index.html';
        }
    };

    /**
     * Activa o desactiva el modo de edición del formulario.
     */
    const setEditMode = (isEditing) => {
        viewModeElements.forEach(el => el.classList.toggle('hidden', isEditing));
        editModeElements.forEach(el => el.classList.toggle('hidden', !isEditing));
        
        // ** MODIFICACIÓN **
        // "Editar" y "Cerrar Sesión" se ocultan/muestran juntos
        editButton.classList.toggle('hidden', isEditing);
        logoutButton.classList.toggle('hidden', isEditing); // <-- AÑADIDO
        
        document.getElementById('editActions').classList.toggle('hidden', !isEditing);
        uploadButton.classList.toggle('hidden', !isEditing);
    };

    /**
     * Restaura los datos desde 'originalUserData' y vuelve al modo vista.
     */
    const cancelEdit = () => {
        populateDOM(originalUserData);
        fullUserData = { ...originalUserData };
        newProfilePicBase64 = null; 
        setEditMode(false);
    };

    /**
     * Envía los cambios del perfil al backend (PUT /perfil/{id})
     */
    const saveChanges = async () => {
        
        // --- ** LECTURA DE LOS 5 CAMPOS ** ---
        const newNombre = editNombre.value.trim();
        const newApellidoPaterno = editApellidoPaterno.value.trim();
        const newApellidoMaterno = editApellidoMaterno.value.trim();
        const newCorreo = emailInput.value.trim();
        const newTelefono = contactInput.value.trim();
        
        const payload = {
            idUsuario: authInfo.id,
            nombre: newNombre,
            apellidoPaterno: newApellidoPaterno,
            apellidoMaterno: newApellidoMaterno,
            telefono: newTelefono,
            correo: newCorreo,
            imagenPerfil: newProfilePicBase64 || (fullUserData.imagenPerfil || null), 
            rol: authInfo.rol,
            // No se envía 'password'
        };

        try {
            const response = await fetch(`${API_BASE_URL}/perfil/${authInfo.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${authInfo.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 401 || response.status === 403) {
                throw new Error('Sesión inválida o expirada. No se pudieron guardar los cambios.');
            }

            // Ya que arreglaste el backend, esto no debería fallar.
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error al guardar: ${errorText || response.statusText}`);
            }

            // --- Éxito ---
            newProfilePicBase64 = null;
            
            successModal.classList.remove('hidden');
            setTimeout(async () => {
                successModal.classList.add('hidden');
                await loadUserData(); // Recargar datos
                setEditMode(false);
            }, 2000);

        } catch (error) {
            console.error('Error en saveChanges:', error);
            alert(error.message); 
            if (error.message.includes('Sesión inválida')) {
                localStorage.removeItem('usuarioActual');
                window.location.href = '../../index.html';
            }
        }
    };

    // --- ASIGNACIÓN DE EVENTOS ---
    editButton.addEventListener('click', () => setEditMode(true));
    saveButton.addEventListener('click', saveChanges);
    cancelButton.addEventListener('click', cancelEdit);

    uploadButton.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                profileImage.src = e.target.result;
                newProfilePicBase64 = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    logoutButton.addEventListener('click', () => logoutModal.classList.remove('hidden'));
    cancelLogoutBtn.addEventListener('click', () => logoutModal.classList.add('hidden'));
    acceptLogoutBtn.addEventListener('click', () => {
        localStorage.removeItem('usuarioActual');
        window.location.href = '../../index.html';
    });
    
    // --- INICIALIZACIÓN ---
    loadUserData();
    setEditMode(false);
});