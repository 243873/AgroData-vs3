document.addEventListener('DOMContentLoaded', () => {
    const recoverForm = document.getElementById('recoverForm');
    const errorMessage = document.getElementById('errorMessage');

    recoverForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = document.getElementById('email').value.trim();

        if (!email) {
            errorMessage.textContent = t('validation.emailRequired');
            return;
        }

        const jsonData = JSON.stringify({ email: email });
        console.log("JSON listo para enviar:", jsonData);
        alert(t('modal.requestReceived'));
        // Redirigir a la página de actualizar contraseña
        window.location.href = '/actualizar-contrasena/actualizar.html';
    });
});