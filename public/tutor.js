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
    let isSpeaking = false;
    let currentSpeech = null;

    // Error tracking
    let consoleErrors = [];
    const originalConsoleError = console.error;
    console.error = function() {
        consoleErrors.push(Array.from(arguments).join(' '));
        originalConsoleError.apply(console, arguments);
        updateErrorButton();
    };

    function updateErrorButton() {
        const button = document.getElementById('floatingErrorButton');
        if (consoleErrors.length > 0) {
            button.classList.add('has-errors');
        } else {
            button.classList.remove('has-errors');
        }
    }

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
                currentImage = e.target.result.split(',')[1];
                imageButton.style.backgroundColor = '#4F46E5';
                imageButton.textContent = 'Image Added';
            };
            reader.readAsDataURL(file);
        }
    });

    const pathParts = window.location.pathname.split('/');
    const mode = pathParts[pathParts.length - 2];
    const linkId = pathParts[pathParts.length - 1];

    // Set mode-specific styling
    document.body.classList.add(mode);
    document.getElementById('modeTitle').textContent = 
        `${mode.charAt(0).toUpperCase() + mode.slice(1)} - Tutor-Tron`;

    // Text-to-speech functionality
    async function speak(text) {
        const DEEPGRAM_URL = "https://api.deepgram.com/v1/speak?model=aura-arcas-en";
        
        try {
            const response = await fetch(DEEPGRAM_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Token ${window.env.DEEPGRAM_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) {
                throw new Error('Text-to-speech request failed');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            currentSpeech = audio;
            
            audio.onended = () => {
                isSpeaking = false;
                updateSpeakButton();
                currentSpeech = null;
            };

            audio.play();
        } catch (error) {
            console.error('Error during text-to-speech:', error);
            isSpeaking = false;
            updateSpeakButton();
        }
    }

    function updateSpeakButton() {
        const speakButton = document.getElementById('speakButton');
        if (isSpeaking) {
            speakButton.textContent = '🔇 Stop Speaking';
            speakButton.style.backgroundColor = '#dc2626';
        } else {
            speakButton.textContent = '🔊 Speak Response';
            speakButton.style.backgroundColor = '#4b5563';
        }
    }

    // Copy chat functionality
    document.getElementById('copyButton').addEventListener('click', () => {
        const messages = Array.from(chatContainer.children).map(msg => {
            const role = msg.classList.contains('user-message') ? 'You' : 'Tutor';
            return `${role}: ${msg.textContent}`;
        });
        
        const chatText = messages.join('\n\n');
        
        navigator.clipboard.writeText(chatText).then(() => {
            const notification = document.createElement('div');
            notification.className = 'copy-notification';
            notification.textContent = 'Chat copied to clipboard!';
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            showError('Failed to copy chat to clipboard');
        });
    });

    // Speak button handler
    document.getElementById('speakButton').addEventListener('click', () => {
        if (isSpeaking) {
            if (currentSpeech) {
                currentSpeech.pause();
                currentSpeech = null;
            }
            isSpeaking = false;
            updateSpeakButton();
        } else {
            const aiMessages = Array.from(chatContainer.children)
                .filter(msg => msg.classList.contains('ai-message'));
            
            if (aiMessages.length > 0) {
                const lastMessage = aiMessages[aiMessages.length - 1].textContent;
                isSpeaking = true;
                updateSpeakButton();
                speak(lastMessage);
            }
        }
    });

    // Error reporting
    async function reportError(error) {
        try {
            const timestamp = new Date().toISOString();
            const errorReport = `[${timestamp}] Error: ${error}\n`;
            
            const response = await fetch('/api/report-error', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: errorReport })
            });

            if (response.ok) {
                alert('Error reported successfully. Thank you!');
            } else {
                alert('Failed to report error. Please try again.');
            }
        } catch (err) {
            console.error('Error reporting failed:', err);
            alert('Failed to report error. Please try again.');
        }
    }

    function showError(message) {
        const errorContainer = document.getElementById('errorContainer');
        const errorMessage = errorContainer.querySelector('.error-message');
        errorMessage.textContent = message;
        errorContainer.style.display = 'block';
        document.getElementById('reportError').onclick = () => reportError(message);
    }

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

    try {
        // Fetch tutor configuration
        const response = await fetch(`/api/tutor/${linkId}`);
        if (!response.ok) {
            window.location.href = '/invalid-link.html';
            return;
        }
        
        const tutorConfig = await response.json();
        document.getElementById('subjectTitle').textContent = tutorConfig.subject;
        
        // Set up system message
        const systemMessage = `You are an AI teacher named "Tutor-Tron". ${tutorConfig.prompt}`;
        conversationHistory.push({ role: "system", content: systemMessage });
        
        // Send initial prompt
        loadingDiv.style.display = 'block';
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
                        messages: [
                            { role: "system", content: systemMessage },
                            { role: "user", content: tutorConfig.prompt }
                        ],
                    }),
                });

                if (!response.ok) {
                    currentModelIndex++;
                    continue;
                }

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
    } catch (error) {
        console.error('Error:', error);
        appendMessage('error', 'Failed to initialize Tutor-Tron. Please try refreshing the page.');
    } finally {
        loadingDiv.style.display = 'none';
    }

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