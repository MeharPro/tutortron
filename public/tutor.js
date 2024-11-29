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
                    console.log('MathJax is ready');
                    MathJax.startup.defaultReady();
                    mathJaxReady = true;
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
    
    // State variables
    const conversationHistory = [];
    let currentImage = null;
    let isSpeaking = false;
    let currentSpeech = null;
    let consoleErrors = [];
    let isProcessing = false;
    let mathJaxReady = false;

    // Error tracking setup
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

    // Get path info and set mode
    const pathParts = window.location.pathname.split('/');
    const mode = pathParts[pathParts.length - 2];
    const linkId = pathParts[pathParts.length - 1];

    // Set mode-specific styling
    document.body.classList.add(mode);
    document.getElementById('modeTitle').textContent = 
        `${mode.charAt(0).toUpperCase() + mode.slice(1)} - Tutor-Tron`;

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

    // Define models
    const VISION_MODEL = "meta-llama/llama-3.2-90b-vision-instruct:free";
    const models = [
        "meta-llama/llama-3.2-90b-vision-instruct:free",
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
            processEscapes: true,
            packages: ['base', 'ams', 'noerrors', 'noundefined']
        },
        options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
        },
        startup: {
            ready: () => {
                console.log('MathJax is ready');
                MathJax.startup.defaultReady();
                mathJaxReady = true;
            }
        }
    };

    // Load MathJax
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
    script.async = true;
    document.head.appendChild(script);

    // Add styling
    const mathStyle = document.createElement('style');
    mathStyle.textContent = `
        .message {
            margin: 10px;
            padding: 10px;
            border-radius: 8px;
            max-width: 80%;
            font-size: 14px;
            line-height: 1.5;
        }
        .paragraph {
            margin: 12px 0;
        }
        .bullet {
            margin: 8px 0;
            padding-left: 8px;
        }
        h3 {
            margin: 16px 0 8px 0;
            font-size: 15px;
            font-weight: 600;
            color: #333;
        }
        strong {
            font-weight: 600;
            color: #000;
        }
        .mjx-chtml {
            margin: 0 3px !important;
        }
    `;
    document.head.appendChild(mathStyle);

    // Content formatting functions
    function formatMathContent(content) {
        // Handle LaTeX delimiters
        content = content
            .replace(/\\\((.*?)\\\)/g, '$ $1 $')
            .replace(/\\\[(.*?)\\\]/g, '$$ $1 $$');

        // Format bullet points
        content = content.replace(/^\* /gm, '• ');

        // Format double ## at start of line to make entire line bold
        content = content.replace(/^##\s*(.*?)$/gm, '<strong>$1</strong>');

        // Handle general formatting
        content = content
            .replace(/\n\n/g, '<br><br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        return content;
    }

    function appendMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        if (type === 'ai') {
            content = formatMathContent(content);
            content = content
                .replace(/^Step (\d+)/gm, '<h3>Step $1</h3>')
                .replace(/^• (.*?)$/gm, '<div class="bullet">• $1</div>')
                .replace(/<br><br>/g, '</div><div class="paragraph">');
            
            messageDiv.innerHTML = `<div class="paragraph">${content}</div>`;
            
            if (mathJaxReady && window.MathJax?.typesetPromise) {
                window.MathJax.typesetPromise([messageDiv]).catch(err => 
                    console.error('MathJax error:', err)
                );
            }
        } else {
            messageDiv.textContent = content;
        }
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

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

    // Error handling
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

    // Event listeners
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

    // Initialize tutor
    try {
        const response = await fetch(`/api/tutor/${linkId}`);
        if (!response.ok) {
            window.location.href = '/invalid-link.html';
            return;
        }
        
        const tutorConfig = await response.json();
        document.getElementById('subjectTitle').textContent = tutorConfig.subject;
        
        const systemMessage = `You are an AI teacher named "Tutor-Tron". ${tutorConfig.prompt}`;
        conversationHistory.push({ role: "system", content: systemMessage });
        
        // Get initial response
        loadingDiv.style.display = 'block';
        let success = false;
        let currentModelIndex = 0;

        while (!success && currentModelIndex < models.length) {
            const currentModel = models[currentModelIndex];
            console.log(`Trying model (${currentModelIndex + 1}/${models.length}): ${currentModel}`);
            
            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${window.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: currentModel,
                        messages: [
                            { role: "system", content: systemMessage },
                            { role: "user", content: tutorConfig.prompt }
                        ],
                    }),
                });

                if (!response.ok) {
                    console.log(`Model ${currentModel} failed with status ${response.status}, trying next...`);
                    currentModelIndex++;
                    continue;
                }

                const data = await response.json();
                console.log(`Successfully using model: ${currentModel}`);
                const aiMessage = data.choices[0].message.content;
                conversationHistory.push({ role: "assistant", content: aiMessage });
                appendMessage('ai', aiMessage);
                success = true;
            } catch (error) {
                console.error(`Error with model ${currentModel}:`, error);
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

    // Message handling functions
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
        console.log(`Using vision model: ${VISION_MODEL}`);
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

        if (!response.ok) {
            console.error(`Vision model failed with status ${response.status}`);
            throw new Error('Vision model failed');
        }

        const data = await response.json();
        console.log("Vision model response received");
        
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
            const currentModel = models[currentModelIndex];
            console.log(`Trying model (${currentModelIndex + 1}/${models.length}): ${currentModel}`);
            
            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${window.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: currentModel,
                        messages: conversationHistory
                    }),
                });

                if (!response.ok) {
                    console.log(`Model ${currentModel} failed with status ${response.status}, trying next...`);
                    currentModelIndex++;
                    continue;
                }

                const data = await response.json();
                console.log(`Successfully using model: ${currentModel}`);
                const aiMessage = data.choices[0].message.content;
                conversationHistory.push({ role: "assistant", content: aiMessage });
                appendMessage('ai', aiMessage);
                success = true;
            } catch (error) {
                console.error(`Error with model ${currentModel}:`, error);
                currentModelIndex++;
            }
        }

        if (!success) {
            throw new Error('All models failed');
        }
    }

    // Add message input handlers
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}); 