document.addEventListener('DOMContentLoaded', () => {
    const updateForm = document.getElementById('updateForm');
    const errorMessage = document.getElementById('errorMessage');
    const modal = document.getElementById('confirmationModal');
    const acceptButton = document.getElementById('acceptButton');

    const validatePassword = (password) => {
        if (password.length < 8) return t('passwordValidation.minLength');
        if (!/[A-Z]/.test(password)) return t('passwordValidation.uppercase');
        if (!/[a-z]/.test(password)) return t('passwordValidation.lowercase');
        if (!/[0-9]/.test(password)) return t('passwordValidation.number');
        return null;
    };

    updateForm.addEventListener('submit', (event) => {
        event.preventDefault();
        errorMessage.textContent = '';
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            errorMessage.textContent = t('passwordValidation.mismatch');
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            errorMessage.textContent = `${t('passwordValidation.invalidPrefix')} ${passwordError}`;
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