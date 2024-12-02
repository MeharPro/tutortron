document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById('loginForm');
    const messageDiv = document.getElementById('loginMessage');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.className = 'success-message';
                messageDiv.textContent = 'Login successful! Redirecting...';
                
                // Store the token
                localStorage.setItem('teacherToken', data.token);
                
                // Redirect to the correct dashboard page
                setTimeout(() => {
                    window.location.href = '/pros-only-teachers.html';
                }, 1500);
            } else {
                messageDiv.className = 'error-message';
                messageDiv.textContent = data.message || 'Login failed';
            }
        } catch (error) {
            messageDiv.className = 'error-message';
            messageDiv.textContent = 'An error occurred. Please try again.';
            console.error('Login error:', error);
        }
    });

    // Check if we're on a protected page
    if (window.location.pathname.includes('pros-only-teachers.html')) {
        checkAuth();
    }
});

// Authentication check function
async function checkAuth() {
    const token = localStorage.getItem('teacherToken');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            localStorage.removeItem('teacherToken');
            window.location.href = '/index.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('teacherToken');
        window.location.href = '/index.html';
    }
}