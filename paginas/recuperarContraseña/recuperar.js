document.addEventListener('DOMContentLoaded', () => {
    const recoverForm = document.getElementById('recoverForm');
    const errorMessage = document.getElementById('errorMessage');

    recoverForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = document.getElementById('email').value.trim();

        if (!email) {
            errorMessage.textContent = 'Por favor, ingresa tu correo.';
            return;
        }

        const jsonData = JSON.stringify({ email: email });
        console.log("JSON listo para enviar:", jsonData);
        alert('Se ha enviado un correo de recuperación. Serás redirigido.');
        // Redirigir a la página de actualizar contraseña
        window.location.href = '/actualizar-contrasena/actualizar.html';
    });
});