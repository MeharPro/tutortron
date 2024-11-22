document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const school = document.getElementById('registerSchool').value;
        const accessCode = document.getElementById('accessCode').value;
        const messageDiv = document.getElementById('registerMessage');

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    name, 
                    email, 
                    password, 
                    school,
                    accessCode 
                }),
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
        }
    });
}); 