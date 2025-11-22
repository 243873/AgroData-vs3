document.addEventListener("DOMContentLoaded", function() {

    const registerForm = document.getElementById("registerForm");
    const submitBtn = document.querySelector(".submit-btn");

    const nombreInput = document.getElementById("nombre");
    const apellidoPaternoInput = document.getElementById("apellidoPaterno");
    const apellidoMaternoInput = document.getElementById("apellidoMaterno");
    const contactoInput = document.getElementById("Contacto");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");

    const errorNombre = document.getElementById("errorNombre");
    const errorApellidoPaterno = document.getElementById("errorApellidoPaterno");
    const errorApellidoMaterno = document.getElementById("errorApellidoMaterno");
    const errorContacto = document.getElementById("errorContacto");
    const errorEmail = document.getElementById("errorEmail");
    const errorPassword = document.getElementById("errorPassword");
    const errorConfirmPassword = document.getElementById("errorConfirmPassword");
    
    if (localStorage.getItem("usuarios")) {
         localStorage.removeItem("usuarios");
         console.log("Usuarios de prueba de localStorage eliminados. Usando API real.");
    }
    
    // Lógica de validación local 
    function validarRegistro(nombre, ap, am, tel, corr, pass, confPass) {
        // Limpiar errores previos en cada envío.
        document.querySelectorAll(".error-message").forEach(p => p.textContent = "");
        let isValid = true;
        
        if (nombre === "") { errorNombre.textContent = t('validation.nameRequired'); isValid = false; }
        if (ap === "") { errorApellidoPaterno.textContent = t('validation.lastNameRequired'); isValid = false; }
        if (am === "") { errorApellidoMaterno.textContent = t('validation.motherNameRequired'); isValid = false; }
        
        if (tel === "") {
            errorContacto.textContent = t('validation.contactRequired'); isValid = false;
        } else if (!/^\d{10}$/.test(tel)) {
            errorContacto.textContent = t('validation.phoneDigits'); isValid = false;
        }
        
        // Validación del correo electrónico
        if (corr === "") {
            errorEmail.textContent = t('validation.emailRequired'); isValid = false;
        } else if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(corr)) {
            errorEmail.textContent = t('validation.gmailRequired'); isValid = false;
        }
        // NOTA: La validación de si el correo ya existe se hará en el servidor (API)
        
        // Validación de contraseña
        const passwordRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&ñÑ])[A-Za-z\\d@$!%*?&ñÑ]{12,}$");
        if (pass === "") {
            errorPassword.textContent = t('validation.passwordRequired'); isValid = false;
        } else if (!passwordRegex.test(pass)) {
            errorPassword.textContent = t('validation.passwordRules'); isValid = false;
        }

        // Coincidencia de contraseñas
        if (confPass === "") {
            errorConfirmPassword.textContent = t('validation.confirmPasswordRequired'); isValid = false;
        } else if (pass !== confPass) {
            errorConfirmPassword.textContent = t('validation.passwordMismatch'); isValid = false;
        }

        return isValid;
    }


    registerForm.addEventListener("submit", async function(e) {
        e.preventDefault(); 

        // --- OBTENCIÓN Y LIMPIEZA DE VALORES ---
        const nombre = nombreInput.value.trim();
        const apellidoPaterno = apellidoPaternoInput.value.trim();
        const apellidoMaterno = apellidoMaternoInput.value.trim();
        const telefono = contactoInput.value.trim();
        const correo = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
        
        if (!validarRegistro(nombre, apellidoPaterno, apellidoMaterno, telefono, correo, password, confirmPassword)) {
            return; // Detiene la ejecución si la validación local falla.
        }


        // 1. Preparar datos como JSON (
        const nuevoUsuario = {
            nombre,
            apellidoPaterno,
            apellidoMaterno,
            telefono,
            correo,
            password, // La API se  hashea esto con BCrypt
            imagenPerfil: "default.jpg", 
            rol: 2 
        };

        // 2. Ejecutar la llamada a la API
        submitBtn.disabled = true;
        errorEmail.textContent = t('validation.registering'); 

        try {
            const response = await fetch(`${API_BASE_URL}/registro`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(nuevoUsuario) 
            });
            
            const responseBodyText = await response.text(); 

            if (response.status === 201) { 
                alert(t('validation.accountCreated'));
                window.location.href = "/index.html"; // Redirige al login

            } else { 

                errorEmail.textContent = responseBodyText || t('validation.unknownError');
            }

        } catch (error) {
            console.error("Error de red/servidor:", error);
            errorEmail.textContent = t('validation.serverError');
        } finally {
            submitBtn.disabled = false;
        }
    });
});