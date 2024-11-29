console.log('tutor.js loaded');
document.addEventListener("DOMContentLoaded", async () => {
    await window.envLoaded;
    
    // Get DOM elements
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    const loadingDiv = document.getElementById('loading');
    
    const conversationHistory = [];
    let currentImage = null;

    // Create image input elements
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.style.display = 'none';

    const imageButton = document.createElement('button');
    imageButton.textContent = 'Add Image';
    imageButton.className = 'image-button';
    messageInput.parentNode.insertBefore(imageButton, sendButton);
    messageInput.parentNode.insertBefore(imageInput, sendButton);

    imageButton.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                currentImage = e.target.result.split(',')[1]; // Get base64 part
                imageButton.style.backgroundColor = '#4F46E5';
                imageButton.textContent = 'Image Added';
            };
            reader.readAsDataURL(file);
        }
    });

    const pathParts = window.location.pathname.split('/');
    const mode = pathParts[pathParts.length - 2];  // Get mode from URL
    const linkId = pathParts[pathParts.length - 1];

    // Define vision model constant
    const VISION_MODEL = "meta-llama/llama-3.2-90b-vision-instruct:free";
    
    const models = [
        "google/learnlm-1.5-pro-experimental:free",
        "openchat/openchat-7b:free",
        "liquid/lfm-40b:free",
        "google/gemini-exp-1121:free",
        "google/gemma-2-9b-it:free",
        "meta-llama/llama-3.1-405b-instruct:free",
        "qwen/qwen-2-7b-instruct:free"
    ];

    // MathJax configuration
    window.MathJax = {
        tex: {
            inlineMath: [['$', '$']],
            displayMath: [['$$', '$$']],
            processEscapes: true
        },
        options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
        }
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
    script.async = true;
    document.head.appendChild(script);

    // Function to format math content
    function formatMathContent(content) {
        // Format step headers
        content = content.replace(/^## /gm, '');
        
        // Format inline math expressions
        content = content.replace(/(\d+)\s*tan\s*\(\s*x\s*\)/g, '$$$1\\tan(x)$$');
        content = content.replace(/tan\s*\(\s*x\s*\)/g, '$$\\tan(x)$$');
        content = content.replace(/tan\^2\s*\(\s*x\s*\)/g, '$$\\tan^2(x)$$');
        
        // Format bullet points
        content = content.replace(/^\* /gm, '• ');
        
        return content;
    }

    async function typesetMath(element) {
        let retries = 0;
        const maxRetries = 10;
        
        while (retries < maxRetries) {
            if (window.MathJax?.typesetPromise) {
                try {
                    await window.MathJax.typesetPromise([element]);
                    return;
                } catch (error) {
                    console.error('MathJax typesetting error:', error);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            retries++;
        }
    }

    function appendMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        if (type === 'ai') {
            content = formatMathContent(content);
            
            content = content
                .replace(/^Step (\d+)/gm, '<h3>Step $1</h3>')
                .replace(/^• (.*?)$/gm, '<div class="bullet">• $1</div>')
                .replace(/\n\n/g, '</div><div class="paragraph">')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            messageDiv.innerHTML = `<div class="paragraph">${content}</div>`;
            
            if (window.MathJax) {
                setTimeout(() => {
                    typesetMath(messageDiv).catch(err => 
                        console.error('Failed to typeset math:', err)
                    );
                }, 100);
            }
        } else {
            messageDiv.textContent = content;
        }
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Handle sending messages
    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        appendMessage('user', message);
        messageInput.value = '';
        messageInput.style.height = 'auto';

        try {
            if (currentImage) {
                console.log("Processing image request with vision model:", VISION_MODEL);
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${window.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: VISION_MODEL,
                        messages: [
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: message
                                    },
                                    {
                                        type: "image_url",
                                        image_url: {
                                            url: `data:image/jpeg;base64,${currentImage}`
                                        }
                                    }
                                ]
                            }
                        ]
                    })
                });

                if (!response.ok) {
                    throw new Error('Vision model failed');
                }

                const data = await response.json();
                console.log("Vision model response:", data);

                if (!data.choices?.[0]?.message?.content) {
                    throw new Error('Empty response from vision model');
                }

                const aiMessage = data.choices[0].message.content;
                conversationHistory.push({
                    role: "user",
                    content: `[Image uploaded] ${message}`
                });
                conversationHistory.push({
                    role: "assistant",
                    content: aiMessage
                });
                
                appendMessage('ai', aiMessage);

                // Reset image state
                currentImage = null;
                imageButton.style.backgroundColor = '';
                imageButton.textContent = 'Add Image';
                imageInput.value = '';
            } else {
                // No image - use regular models with retry logic
                let success = false;
                let retries = 0;
                
                conversationHistory.push({
                    role: "user",
                    content: message
                });

                while (!success && retries < models.length) {
                    try {
                        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${window.env.OPENROUTER_API_KEY}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                model: models[retries],
                                messages: conversationHistory
                            }),
                        });

                        if (!response.ok) throw new Error('Model failed');

                        const data = await response.json();
                        const aiMessage = data.choices[0].message.content;
                        conversationHistory.push({ role: "assistant", content: aiMessage });
                        appendMessage('ai', aiMessage);
                        success = true;
                    } catch (error) {
                        console.error(`Error with model ${models[retries]}:`, error);
                        retries++;
                    }
                }

                if (!success) {
                    throw new Error('All models failed');
                }
            }
        } catch (error) {
            console.error("Error:", error);
            appendMessage('error', 'Failed to get response. Please try again.');
        }
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}); 