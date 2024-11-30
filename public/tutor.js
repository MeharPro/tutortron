console.log('tutor.js loaded');
        // Add MathJax configuration
        window.MathJax = {
            tex: {
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']],
                processEscapes: true,
                processEnvironments: true,
                packages: ['base', 'ams', 'noerrors', 'noundefined']
            },
            options: {
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
                ignoreHtmlClass: 'tex2jax_ignore',
                processHtmlClass: 'tex2jax_process'
            },
            startup: {
                ready: () => {
                    console.log('MathJax is ready');
                    MathJax.startup.defaultReady();
                    mathJaxReady = true;
                    // Typeset any existing math content
                    MathJax.typesetPromise().catch((err) => console.error('MathJax typeset error:', err));
                }
            }
        };

// Load MathJax
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
script.async = true;

document.head.appendChild(script);

// Load highlight.js
const highlightScript = document.createElement('script');
highlightScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
highlightScript.onload = () => {
    console.log('Highlight.js loaded');
    // Load common languages
    ['cpp', 'python', 'javascript', 'java', 'csharp'].forEach(lang => {
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/${lang}.min.js`;
        document.head.appendChild(script);
    });
};
document.head.appendChild(highlightScript);

// Load highlight.js CSS
const highlightCSS = document.createElement('link');
highlightCSS.rel = 'stylesheet';
highlightCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css';
document.head.appendChild(highlightCSS);

document.addEventListener("DOMContentLoaded", async () => {
    await window.envLoaded;
    
    // Get DOM elements
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    const loadingDiv = document.getElementById('loading');
    
    // State variables
    const conversationHistory = [];
    let isProcessing = false;
    let mathJaxReady = false;
    let currentAudio = null;
    let currentModelIndex = 0;

    // Utility functions
    function showError(message) {
        const errorDiv = document.getElementById('errorContainer');
        if (errorDiv) {
            const errorMessage = errorDiv.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.textContent = message;
                errorDiv.style.display = 'block';
                setTimeout(() => {
                    errorDiv.style.display = 'none';
                }, 5000);
            }
        }
    }

    function appendMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        // Format content with MathJax and code highlighting
        const formattedContent = formatContent(content);
        messageDiv.innerHTML = formattedContent;
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Render MathJax if ready
        if (mathJaxReady && window.MathJax) {
            window.MathJax.typesetPromise([messageDiv]);
        }
        
        // Apply code highlighting
        messageDiv.querySelectorAll('pre code').forEach((block) => {
            if (window.hljs) {
                window.hljs.highlightElement(block);
            }
        });
    }

    function formatContent(content) {
        // Handle code blocks
        content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || '';
            return `<pre><code class="language-${language}">${code.trim()}</code></pre>`;
        });

        // Handle inline code
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Handle math expressions
        content = content
            .replace(/\$\$([\s\S]*?)\$\$/g, '<div class="math">$$$1$$</div>')
            .replace(/\$(.*?)\$/g, '<span class="math">$1</span>');

        // Handle markdown
        content = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/\n\n/g, '<br><br>');

        return content;
    }

    // Get API keys
    let apiKeys;
    try {
        const keyResponse = await fetch('/api/keys');
        apiKeys = await keyResponse.json();
        if (!apiKeys || !apiKeys.OPENROUTER_API_KEY) {
            throw new Error('API key not found');
        }
    } catch (error) {
        console.error('Failed to fetch API keys:', error);
        showError('Failed to initialize the tutor. Please try again later.');
        return;
    }

    // Get configuration from window.TUTOR_CONFIG
    const { subject, prompt, mode } = window.TUTOR_CONFIG;
    
    // Set mode-specific styling
    document.body.classList.add(mode.toLowerCase());

    // Available free models
    const FREE_MODELS = [
        "google/learnlm-1.5-pro-experimental:free",
        "meta-llama/llama-3.1-405b-instruct:free",
        "liquid/lfm-40b:free",
        "google/gemini-exp-1114",
        "meta-llama/llama-3.1-70b-instruct:free",
        "google/gemma-2-9b-it:free",
        "qwen/qwen-2-7b-instruct:free"
    ];

    const VISION_MODEL = "meta-llama/llama-3.2-90b-vision-instruct:free";

    // Function to get next model when one fails
    function getNextModel() {
        currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
        return FREE_MODELS[currentModelIndex];
    }

    // Function to make API request
    async function makeModelRequest(messages, useVision = false) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKeys.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://tutortron.dizon-dzn12.workers.dev/',
                'X-Title': 'Tutor-Tron'
            },
            body: JSON.stringify({
                model: useVision ? VISION_MODEL : FREE_MODELS[currentModelIndex],
                messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || 'API Error');
        }

        if (!data.choices?.[0]?.message?.content && 
            !data.choices?.[0]?.text && 
            !data.choices?.[0]?.content) {
            throw new Error('No response content');
        }

        return data.choices[0].message?.content || 
               data.choices[0].text || 
               data.choices[0].content;
    }

    // Function to try multiple models
    async function tryModels(messages, useVision = false) {
        let attempts = 0;
        
        while (attempts < FREE_MODELS.length) {
            try {
                const aiMessage = await makeModelRequest(messages, useVision);
                return aiMessage;
            } catch (error) {
                console.error(`Error with model ${FREE_MODELS[currentModelIndex]}:`, error);
                currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
                attempts++;
                
                if (attempts === FREE_MODELS.length) {
                    throw new Error('All models failed');
                }
            }
        }
    }

    // Initialize conversation with prompt
    if (prompt) {
        try {
            isProcessing = true;
            if (loadingDiv) loadingDiv.style.display = 'block';

            const systemMessage = {
                role: "system",
                content: `You are a tutor helping a student with ${subject}. ${prompt}`
            };
            conversationHistory.push(systemMessage);

            const aiMessage = await tryModels([systemMessage]);
            
            conversationHistory.push({
                role: "assistant",
                content: aiMessage
            });

            appendMessage('ai', aiMessage);

        } catch (error) {
            console.error('Initialization error:', error);
            showError(`Failed to get response from tutor: ${error.message}`);
        } finally {
            isProcessing = false;
            if (loadingDiv) loadingDiv.style.display = 'none';
        }
    }

    // Handle sending messages
    async function handleSendMessage(isImageMessage = false) {
        if (isProcessing || (!isImageMessage && !messageInput.value.trim())) return;
        
        isProcessing = true;
        if (loadingDiv) loadingDiv.style.display = 'block';
        
        try {
            const userMessage = isImageMessage ? 
                conversationHistory[conversationHistory.length - 1] : 
                {
                    role: "user",
                    content: messageInput.value.trim()
                };
                
            if (!isImageMessage) {
                appendMessage('user', userMessage.content);
                conversationHistory.push(userMessage);
                messageInput.value = '';
            }

            const aiMessage = await tryModels(
                conversationHistory,
                isImageMessage
            );

            conversationHistory.push({
                role: "assistant",
                content: aiMessage
            });

            appendMessage('ai', aiMessage);
            
        } catch (error) {
            console.error('Send message error:', error);
            showError('Failed to get response. Please try again.');
        } finally {
            isProcessing = false;
            if (loadingDiv) loadingDiv.style.display = 'none';
        }
    }

    // Event listeners
    if (sendButton) {
        sendButton.addEventListener('click', () => handleSendMessage());
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    // Image upload functionality
    function addImageUploadUI() {
        const inputSection = document.querySelector('.input-section');
        const uploadContainer = document.createElement('div');
        uploadContainer.className = 'upload-container';
        uploadContainer.innerHTML = `
            <div class="image-upload">
                <label for="imageUpload" class="upload-label">
                    <span>📷</span> Add Image
                </label>
                <input type="file" id="imageUpload" accept="image/*" style="display: none;">
            </div>
            <div id="imagePreview" class="image-preview"></div>
        `;
        
        inputSection.insertBefore(uploadContainer, inputSection.firstChild);
    }

    function handleImageUpload(file) {
        const preview = document.getElementById('imagePreview');
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Uploaded image">
                <button class="remove-image" onclick="this.parentElement.remove()">×</button>
            `;
            preview.appendChild(div);

            // Add image to conversation
            const base64Image = e.target.result;
            conversationHistory.push({
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "I've uploaded an image. Please analyze it."
                    },
                    {
                        type: "image_url",
                        image_url: base64Image
                    }
                ]
            });

            // Get AI response
            await handleSendMessage(true);
        };
        
        reader.readAsDataURL(file);
    }

    // Add image upload styles
    const imageStyles = document.createElement('style');
    imageStyles.textContent = `
        .upload-container {
            margin-bottom: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        
        .image-upload {
            display: flex;
            align-items: center;
        }
        
        .upload-label {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background-color: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .upload-label:hover {
            background-color: #e5e7eb;
        }
        
        .image-preview {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        
        .preview-item {
            position: relative;
            width: 100px;
            height: 100px;
            border-radius: 0.5rem;
            overflow: hidden;
        }
        
        .preview-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .remove-image {
            position: absolute;
            top: 0.25rem;
            right: 0.25rem;
            background: rgba(0, 0, 0, 0.5);
            color: white;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }
        
        .remove-image:hover {
            background: rgba(0, 0, 0, 0.7);
        }

        .button-group {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.5rem;
        }

        #speakButton, #copyButton {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 14px;
            transition: background-color 0.2s;
        }

        #speakButton {
            background-color: #4a9d57;
            color: white;
        }

        #speakButton:hover {
            background-color: #3c8746;
        }

        #copyButton {
            background-color: #4b5563;
            color: white;
        }

        #copyButton:hover {
            background-color: #374151;
        }
    `;
    document.head.appendChild(imageStyles);

    // Add styles for messages
    const messageStyles = document.createElement('style');
    messageStyles.textContent = `
        .message {
            margin: 1rem 0;
            padding: 1rem;
            border-radius: 0.5rem;
            max-width: 80%;
            word-wrap: break-word;
        }

        .user-message {
            background-color: #f3f4f6;
            margin-left: auto;
        }

        .ai-message {
            background-color: #e5e7eb;
            margin-right: auto;
        }

        .message pre {
            background: #1e1e1e;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
        }

        .message code {
            font-family: 'Fira Code', monospace;
            background: rgba(0,0,0,0.05);
            padding: 0.2em 0.4em;
            border-radius: 0.3em;
        }

        .message pre code {
            background: none;
            padding: 0;
        }

        .math {
            font-family: 'KaTeX_Math', serif;
        }

        .math-display {
            overflow-x: auto;
            margin: 1em 0;
            padding: 1em;
            background: rgba(0,0,0,0.03);
            border-radius: 4px;
        }
    `;
    document.head.appendChild(messageStyles);
}); 