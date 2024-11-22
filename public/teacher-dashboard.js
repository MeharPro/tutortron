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

document.addEventListener("DOMContentLoaded", async () => {
    await checkAuth();
    
    const promptInput = document.getElementById("promptInput");
    const subjectInput = document.getElementById("subjectInput");
    const createLinkBtn = document.getElementById("createLinkBtn");
    const linksList = document.getElementById("linksList");
    const token = localStorage.getItem('teacherToken');

    // Function to show messages
    function showMessage(message, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.className = isError ? 'error-message' : 'success-message';
        messageDiv.style.marginTop = '10px';
        
        // Insert message after the create button
        createLinkBtn.parentNode.insertBefore(messageDiv, createLinkBtn.nextSibling);
        
        // Remove message after 3 seconds
        setTimeout(() => messageDiv.remove(), 3000);
    }

    // Function to load links from MongoDB
    async function loadLinks() {
        try {
            const response = await fetch('/api/links', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load links');
            }
            
            const links = await response.json();
            linksList.innerHTML = ''; // Clear existing links
            
            links.forEach(link => {
                const linkCard = document.createElement('div');
                linkCard.className = 'link-card';
                const fullUrl = `https://tutortron.pages.dev/tutor/${link.id}`;
                linkCard.innerHTML = `
                    <h3>${link.subject}</h3>
                    <div class="link-url">${fullUrl}</div>
                    <div class="prompt-preview">${link.prompt}</div>
                    <button class="copy-link-btn" onclick="navigator.clipboard.writeText('${fullUrl}')">
                        Copy Link
                    </button>
                    <button class="delete-link-btn" data-id="${link.id}">Delete</button>
                `;
                linksList.appendChild(linkCard);
            });
            
            // Add event listeners for delete buttons
            document.querySelectorAll('.delete-link-btn').forEach(btn => {
                btn.addEventListener('click', () => deleteLink(btn.dataset.id));
            });
            
        } catch (error) {
            console.error('Error loading links:', error);
            showMessage('Failed to load links', true);
        }
    }

    // Function to create a new link
    async function createLink(subject, prompt) {
        try {
            const response = await fetch('/api/links', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ subject, prompt })
            });
            
            if (!response.ok) {
                throw new Error('Failed to create link');
            }
            
            await loadLinks();
            return true;
        } catch (error) {
            console.error('Error creating link:', error);
            return false;
        }
    }

    // Function to delete a link
    async function deleteLink(linkId) {
        try {
            const response = await fetch(`/api/links/${linkId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete link');
            }
            
            await loadLinks();
            showMessage('Link deleted successfully');
        } catch (error) {
            console.error('Error deleting link:', error);
            showMessage('Failed to delete link', true);
        }
    }

    // Create Link button click handler
    createLinkBtn.addEventListener("click", async () => {
        const subject = subjectInput.value.trim();
        const prompt = promptInput.value.trim();
        
        if (!subject || !prompt) {
            showMessage('Please fill in both subject and prompt fields', true);
            return;
        }

        createLinkBtn.disabled = true;
        createLinkBtn.textContent = "Creating...";

        try {
            const success = await createLink(subject, prompt);
            
            if (success) {
                subjectInput.value = '';
                promptInput.value = '';
                showMessage('Link created successfully!');
            } else {
                showMessage('Failed to create link', true);
            }
        } catch (error) {
            showMessage('An error occurred', true);
        } finally {
            createLinkBtn.disabled = false;
            createLinkBtn.textContent = "Create Tutor Link";
        }
    });

    // Initial load of links
    await loadLinks();
}); 