document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById('registerForm');
    const messageDiv = document.getElementById('registerMessage');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const school = document.getElementById('registerSchool').value;
        const accessCode = document.getElementById('accessCode').value;

        // Check if passwords match
        if (password !== confirmPassword) {
            messageDiv.className = 'error-message';
            messageDiv.textContent = 'Passwords do not match';
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password, school, accessCode }),
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.className = 'success-message';
                messageDiv.textContent = 'Registration successful! Redirecting to login...';
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 2000);
            } else {
                messageDiv.className = 'error-message';
                messageDiv.textContent = data.message || 'Registration failed';
            }
        } catch (error) {
            messageDiv.className = 'error-message';
            messageDiv.textContent = 'An error occurred. Please try again.';
            console.error('Registration error:', error);
        }
    });
}); 