// main.js (INICIO DE SESIÓN - CÓDIGO FINAL CORREGIDO CON TOKEN)

document.addEventListener("DOMContentLoaded", function () {
    
    // Elementos del DOM
    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorEmail = document.getElementById("errorEmail");
    const errorPassword = document.getElementById("errorPassword");
    const submitBtn = document.querySelector(".submit-btn");

    // Lógica para limpiar datos de prueba antiguos (localStorage)
    if (localStorage.getItem("usuarios")) {
         localStorage.removeItem("usuarios");
    }

    // Función de validación local (se mantiene tu lógica)
    function validarLocalmente(correo, password) {
        let isValid = true;
        errorEmail.textContent = "";
        errorPassword.textContent = "";

        if (correo === "") {
            errorEmail.textContent = t('login.emailRequired');
            isValid = false;
        }
        if (password === "") {
            errorPassword.textContent = t('login.passwordRequired');
            isValid = false;
        }
        return isValid;
    }

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault(); 

        const correo = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!validarLocalmente(correo, password)) {
            return; 
        }

        // --- INICIO DE CONEXIÓN CON LA API ---
        
        // El back-end espera FormData (ctx.formParam) para el /login
        const formData = new URLSearchParams();
        formData.append('correo', correo);
        formData.append('password', password); 

        submitBtn.disabled = true; 
        errorPassword.textContent = t('login.logging'); 

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                body: formData 
            });

            const responseBodyText = await response.text(); 
            let data = {};
            
            try {
                // Intentar parsear a JSON. Esperamos: { mensaje, rol, id, token }
                data = JSON.parse(responseBodyText); 
                console.log("Respuesta de la API:", data);
                
                // Las líneas de debug de localStorage (76-78) se han eliminado
                
            } catch (e) {
                // Si falla (texto plano de error), el objeto 'data' contendrá el mensaje.
                data = { mensaje: responseBodyText };
            }
            
            // 3. Manejo de la Respuesta
            if (response.ok) { // Éxito: Status 200 OK
                
                // 🎯 El API devuelve: { mensaje, rol, id, token }
                const rol = data.rol;
                const idUsuario = data.id;
                const token = data.token;
                
                if (!token) {
                    errorPassword.textContent = t('validation.tokenError');
                    return;
                }

                // 🎯 Guardar un solo objeto JSON en localStorage (el método estándar)
                const usuarioActual = {
                    id: idUsuario,
                    rol: rol,
                    token: token
                };
                localStorage.setItem("usuarioActual", JSON.stringify(usuarioActual));

                // Limpiar cualquier dato antiguo de sessionStorage por si acaso
                sessionStorage.clear();
                
                alert(t('login.success'));

                // Redirigir según el rol
                if (rol === 1) { 
                    window.location.href = "/paginas/inicio/inicio.html";
                } else if (rol === 2) { 
                    window.location.href = "/paginas/inicioCliente/inicioCliente.html";
              } else {
                    alert(t('validation.roleNotRecognized'));
                }

            } else { // Fallo: Códigos 4xx o 5xx (ej: 401, 404)
                
                // Muestra el mensaje de error que proviene directamente de la API
                errorPassword.textContent = data.mensaje || responseBodyText || t('validation.loginError');
            }

        } catch (error) {
            // Error de red/conexión (Servidor apagado, CORS)
            console.error("Error de red/servidor:", error);
            errorPassword.textContent = t('validation.connectionError');
        } finally {
            submitBtn.disabled = false;
            if (errorPassword.textContent === t('login.logging')) {
                 errorPassword.textContent = ""; 
            }
        }
    });
});