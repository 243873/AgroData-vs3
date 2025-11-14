document.addEventListener('DOMContentLoaded', () => {
    const updateForm = document.getElementById('updateForm');
    const errorMessage = document.getElementById('errorMessage');
    const modal = document.getElementById('confirmationModal');
    const acceptButton = document.getElementById('acceptButton');

    const validatePassword = (password) => {
        if (password.length < 8) return "Debe tener al menos 8 caracteres.";
        if (!/[A-Z]/.test(password)) return "Debe incluir una mayúscula.";
        if (!/[a-z]/.test(password)) return "Debe incluir una minúscula.";
        if (!/[0-9]/.test(password)) return "Debe incluir un número.";
        return null;
    };

    updateForm.addEventListener('submit', (event) => {
        event.preventDefault();
        errorMessage.textContent = '';
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            errorMessage.textContent = 'Las contraseñas no coinciden.';
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            errorMessage.textContent = `Contraseña no válida: ${passwordError}`;
            return;
        }

        const jsonData = JSON.stringify({ newPassword: password });
        console.log("JSON listo para enviar:", jsonData);
        modal.style.display = 'flex';
    });

    acceptButton.addEventListener('click', () => {
        window.location.href = '../../index.html';
    });
});