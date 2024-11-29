console.log('tutor.js loaded');
        // Add MathJax configuration
        window.MathJax = {
            tex: {
                inlineMath: [['$', '$']],
                displayMath: [['$$', '$$']],
                processEscapes: true,
                packages: ['base', 'ams', 'noerrors', 'noundefined']
            },
            options: {
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
            },
            startup: {
                ready: () => {
                    MathJax.startup.defaultReady();
                    MathJax.startup.promise.then(() => {
                        console.log('MathJax initial typesetting complete');
                    });
                }
            }
        };
document.addEventListener("DOMContentLoaded", async () => {
    await window.envLoaded;
    
    // Get DOM elements
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    const loadingDiv = document.getElementById('loading');
    
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

    // State variables
    const conversationHistory = [];
    let currentImage = null;
    let isSpeaking = false;
    let currentSpeech = null;
    let consoleErrors = [];
    let isProcessing = false;

    // Define models
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

    // Image handling
    imageButton.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                currentImage = e.target.result.split(',')[1];
                imageButton.style.backgroundColor = '#4F46E5';
                imageButton.textContent = 'Image Added';
            };
            reader.readAsDataURL(file);
        }
    });

    // Message handling
    async function sendMessage() {
        if (isProcessing) return;
        
        const message = messageInput.value.trim();
        if (!message) return;

        isProcessing = true;
        loadingDiv.style.display = 'block';
        
        try {
            appendMessage('user', message);
            messageInput.value = '';
            messageInput.style.height = 'auto';

            if (currentImage) {
                await handleImageMessage(message);
            } else {
                await handleTextMessage(message);
            }
        } catch (error) {
            console.error("Error:", error);
            appendMessage('error', 'Failed to get response. Please try again.');
        } finally {
            isProcessing = false;
            loadingDiv.style.display = 'none';
        }
    }

    async function handleImageMessage(message) {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${window.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: VISION_MODEL,
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: message },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${currentImage}` } }
                    ]
                }]
            })
        });

        if (!response.ok) throw new Error('Vision model failed');

        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Empty response from vision model');
        }

        const aiMessage = data.choices[0].message.content;
        conversationHistory.push({ role: "user", content: `[Image uploaded] ${message}` });
        conversationHistory.push({ role: "assistant", content: aiMessage });
        appendMessage('ai', aiMessage);

        // Reset image state
        currentImage = null;
        imageButton.style.backgroundColor = '';
        imageButton.textContent = 'Add Image';
        imageInput.value = '';
    }

    async function handleTextMessage(message) {
        conversationHistory.push({ role: "user", content: message });
        
        let success = false;
        let currentModelIndex = 0;

        while (!success && currentModelIndex < models.length) {
            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${window.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: models[currentModelIndex],
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
                console.error(`Error with model ${models[currentModelIndex]}:`, error);
                currentModelIndex++;
            }
        }

        if (!success) {
            throw new Error('All models failed');
        }
    }

    // Rest of your existing code...
}); 