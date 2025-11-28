document.addEventListener("DOMContentLoaded", function () {
    
    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorEmail = document.getElementById("errorEmail");
    const errorPassword = document.getElementById("errorPassword");
    const submitBtn = document.querySelector(".submit-btn");

    if (localStorage.getItem("usuarios")) {
         localStorage.removeItem("usuarios");
    }

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

                data = JSON.parse(responseBodyText); 
                console.log("Respuesta de la API:", data);
                

                
            } catch (e) {

                data = { mensaje: responseBodyText };
            }
            
            if (response.ok) {
                
                const rol = data.rol;
                const idUsuario = data.id;
                const token = data.token;
                
                if (!token) {
                    errorPassword.textContent = t('validation.tokenError');
                    return;
                }

                const usuarioActual = {
                    id: idUsuario,
                    rol: rol,
                    token: token
                };
                localStorage.setItem("usuarioActual", JSON.stringify(usuarioActual));
                sessionStorage.clear();
                
                alert(t('login.success'));


                if (rol === 1) { 
                    window.location.href = "/paginas/inicio/inicio.html";
                } else if (rol === 2) { 
                    window.location.href = "/paginas/inicioCliente/inicioCliente.html";
              } else {
                    alert(t('validation.roleNotRecognized'));
                }

            } else {
                

                errorPassword.textContent = data.mensaje || responseBodyText || t('validation.loginError');
            }
        } catch (error) {
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