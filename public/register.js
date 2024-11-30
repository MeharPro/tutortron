// Add styles for messages
const style = document.createElement('style');
style.textContent = `
    #registerMessage {
        margin-top: 1rem;
        padding: 1rem;
        border-radius: 0.5rem;
        text-align: center;
        font-weight: 500;
    }

    #registerMessage.error {
        background-color: #FEE2E2;
        color: #DC2626;
    }

    #registerMessage.success {
        background-color: #D1FAE5;
        color: #059669;
    }
`;
document.head.appendChild(style);

// Handle registration form submission
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = '';
    messageDiv.className = '';

    // Get form values
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const school = document.getElementById('registerSchool').value;
    const accessCode = document.getElementById('accessCode').value;

    // Basic validation
    if (password !== confirmPassword) {
        messageDiv.textContent = 'Passwords do not match';
        messageDiv.className = 'error';
        return;
    }

    if (password.length < 8) {
        messageDiv.textContent = 'Password must be at least 8 characters long';
        messageDiv.className = 'error';
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                email,
                password,
                school,
                accessCode
            })
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 403) {
                messageDiv.textContent = 'Invalid access code. Please contact your administrator.';
            } else if (response.status === 400) {
                messageDiv.textContent = 'Email already registered. Please use a different email.';
            } else {
                messageDiv.textContent = data.error || 'Registration failed. Please try again.';
            }
            messageDiv.className = 'error';
            return;
        }

        // Registration successful
        messageDiv.textContent = 'Registration successful! Redirecting to login...';
        messageDiv.className = 'success';
        
        // Store token and redirect
        if (data.token) {
            localStorage.setItem('teacherToken', data.token);
            setTimeout(() => {
                window.location.href = '/pros-only-teachers.html';
            }, 1500);
        } else {
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 1500);
        }
    } catch (error) {
        console.error('Registration error:', error);
        messageDiv.textContent = 'Registration failed. Please try again.';
        messageDiv.className = 'error';
    }
}); 