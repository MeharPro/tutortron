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

// Define available models in order of preference
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

// Keep track of which model we're using
let currentModelIndex = 0;

// Get next model in sequence
function getNextModel() {
    const model = FREE_MODELS[currentModelIndex];
    currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
    return model;
}

// Reset model index if we get a successful response
function resetModelIndex() {
    currentModelIndex = 0;
}

// Modify sendMessage function to use sequential models
async function sendMessage() {
    if (isProcessing) return;
    
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    const imageUpload = document.getElementById('imageUpload');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    
    if (!message && (!imageUpload || !imageUpload.files[0])) return;
    
    isProcessing = true;
    showLoading();
    
    try {
        let imageBase64 = null;
        if (imageUpload && imageUpload.files[0]) {
            imageBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                reader.readAsDataURL(imageUpload.files[0]);
            });
        }

        // Try each model until one works
        let response;
        let data;
        let success = false;

        while (!success && currentModelIndex < FREE_MODELS.length) {
            try {
                const model = imageBase64 ? VISION_MODEL : FREE_MODELS[currentModelIndex];
                
                response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message,
                        subject: window.TUTOR_CONFIG.subject,
                        prompt: window.TUTOR_CONFIG.prompt,
                        mode: window.TUTOR_CONFIG.mode,
                        model,
                        image: imageBase64
                    })
                });

                if (response.ok) {
                    data = await response.json();
                    success = true;
                    resetModelIndex(); // Reset to first model on success
                } else {
                    currentModelIndex++; // Try next model
                }
            } catch (error) {
                console.error(`Error with model ${FREE_MODELS[currentModelIndex]}:`, error);
                currentModelIndex++; // Try next model
            }
        }

        if (!success) {
            throw new Error('All models failed to respond');
        }

        appendMessage(message, 'user');
        if (imageBase64) {
            appendImageMessage(imageUpload.files[0]);
        }
        appendMessage(data.response, 'ai');
        
        // Clear input and image
        messageInput.value = '';
        if (imageUpload) {
            imageUpload.value = '';
            imagePreviewContainer.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error:', error);
        showError('Failed to send message. Please try again.');
        currentModelIndex = 0; // Reset index after all models fail
    } finally {
        isProcessing = false;
        hideLoading();
    }
}

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
    let currentAudio = null;

    // Get API keys
    let apiKeys;
    try {
        const response = await fetch('/api/keys');
        apiKeys = await response.json();
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
    
    // Get link ID from URL
    const pathParts = window.location.pathname.split('/');
    const linkId = pathParts[pathParts.length - 1];

    // Initialize conversation with the prompt and get first response
    if (prompt) {
        isProcessing = true;
        if (loadingDiv) loadingDiv.style.display = 'block';

        try {
            const systemMessage = {
                role: "system",
                content: `You are a tutor helping a student with ${subject}. ${prompt}`
            };
            conversationHistory.push(systemMessage);

            // Initial API call
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeys.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://tutortron.dizon-dzn12.workers.dev/',
                    'X-Title': 'Tutor-Tron'
                },
                body: JSON.stringify({
                    model: FREE_MODELS[currentModelIndex], // Always use first model for initial message
                    messages: conversationHistory,
                    temperature: 0.7,
                    max_tokens: 400
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error Response:', errorData);
                throw new Error(`API response not ok: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            console.log('API Response:', data);

            // Handle different response formats
            let aiMessage;
            if (data.error) {
                console.error('API returned error:', data.error);
                throw new Error(`API Error: ${JSON.stringify(data.error)}`);
            }
            
            if (data.choices && data.choices[0]) {
                if (data.choices[0].message && data.choices[0].message.content) {
                    aiMessage = data.choices[0].message.content;
                } else if (data.choices[0].text) {
                    aiMessage = data.choices[0].text;
                } else if (data.choices[0].content) {
                    aiMessage = data.choices[0].content;
                } else {
                    console.error('Unexpected response format:', data);
                    throw new Error('Unexpected response format from AI');
                }
            } else {
                console.error('No choices in response:', data);
                throw new Error('No response content from AI');
            }

            // Add AI's response to conversation history
            conversationHistory.push({
                role: "assistant",
                content: aiMessage
            });

            // Display the AI's response
            appendMessage('ai', aiMessage);
        } catch (error) {
            console.error('Full error details:', error);
            showError(`Failed to get response from tutor: ${error.message}`);
            throw error;
        } finally {
            isProcessing = false;
            if (loadingDiv) loadingDiv.style.display = 'none';
        }
    }

    // Add image upload button to button group
    const buttonGroup = document.querySelector('.button-group');
    const imageButton = document.createElement('button');
    imageButton.id = 'imageButton';
    imageButton.innerHTML = '<span>🖼️</span> Add Image';
    buttonGroup.appendChild(imageButton);

    // Add file input for image upload
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Add image upload functionality
    imageButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                showError('Image size must be less than 5MB');
                return;
            }

            try {
                // Show loading state
                imageButton.disabled = true;
                imageButton.innerHTML = '<span>🔄</span> Uploading...';

                // Convert image to base64
                const base64Image = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(file);
                });

                // Add image message to chat
                appendMessage('user', `[Uploaded Image]\n${base64Image}`);

                // Add to conversation history
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
            } catch (error) {
                console.error('Error uploading image:', error);
                showError('Failed to upload image. Please try again.');
            } finally {
                // Reset button state
                imageButton.disabled = false;
                imageButton.innerHTML = '<span>🖼️</span> Add Image';
                // Reset file input
                fileInput.value = '';
            }
        }
    });

    // Update handleSendMessage to handle image messages
    async function handleSendMessage() {
        if (isProcessing) return;
        
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        isProcessing = true;
        showLoading();
        
        try {
            // Always start with the first model
            const model = FREE_MODELS[currentModelIndex];
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message,
                    subject: window.TUTOR_CONFIG.subject,
                    prompt: window.TUTOR_CONFIG.prompt,
                    mode: window.TUTOR_CONFIG.mode,
                    model
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get AI response');
            }

            const data = await response.json();
            appendMessage(message, 'user');
            appendMessage(data.response, 'ai');
            
            // Clear input
            messageInput.value = '';
            
            // Reset model index on success
            currentModelIndex = 0;
            
        } catch (error) {
            console.error('Error getting AI response:', error);
            currentModelIndex++; // Try next model on failure
            
            if (currentModelIndex >= FREE_MODELS.length) {
                showError('Failed to get response. Please try again.');
                currentModelIndex = 0; // Reset after trying all models
            } else {
                // Retry with next model
                handleSendMessage();
            }
        } finally {
            isProcessing = false;
            hideLoading();
        }
    }

    // Add message input handlers
    sendButton.addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Add modal for image expansion
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.style.display = 'none';
    modal.onclick = () => modal.style.display = 'none';
    document.body.appendChild(modal);

    // Add modal styles
    const modalStyle = document.createElement('style');
    modalStyle.textContent = `
        .image-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.9);
            z-index: 1000;
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .image-modal img {
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
            border-radius: 8px;
        }
    `;
    document.head.appendChild(modalStyle);

    // Function to append messages to chat
    function appendMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        // Check for image URLs in the content
        const imageUrlMatch = content.match(/https?:\/\/[^\s<>"]+?\.(?:jpg|jpeg|gif|png|webp)(?:\?[^\s<>"]+)?/gi);
        
        if (imageUrlMatch) {
            // Remove image URLs from content
            imageUrlMatch.forEach(url => {
                content = content.replace(url, '');
                // Create and append image element
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'Generated image';
                img.className = 'generated-image';
                // Add click handler for image expansion
                img.onclick = (e) => {
                    e.stopPropagation();
                    modal.innerHTML = `<img src="${url}" alt="Expanded image">`;
                    modal.style.display = 'flex';
                };
                messageDiv.appendChild(img);
            });
        }
        
        // Format content with MathJax and code highlighting
        const formattedContent = formatMathContent(content);
        messageDiv.innerHTML += formattedContent;
        
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

    // Function to format content with MathJax and code highlighting
    function formatMathContent(content) {
        // Language aliases mapping
        const languageAliases = {
            'cpp': 'cpp',
            'c++': 'cpp',
            'Cpp': 'cpp',
            'CPP': 'cpp',
            'py': 'python',
            'python': 'python',
            'Python': 'python',
            'js': 'javascript',
            'javascript': 'javascript',
            'JavaScript': 'javascript',
            'java': 'java',
            'Java': 'java',
            'cs': 'csharp',
            'csharp': 'csharp',
            'c#': 'csharp',
            'C#': 'csharp'
        };

        // First protect code blocks from other formatting
        const codeBlocks = [];
        content = content.replace(/```([\w+]+)?\s*([\s\S]*?)```/g, (match, lang, code) => {
            const normalizedLang = lang ? languageAliases[lang.trim()] || lang.toLowerCase() : '';
            codeBlocks.push({ language: normalizedLang, code: code.trim() });
            return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
        });

        // Handle LaTeX delimiters
        content = content
            .replace(/\\\((.*?)\\\)/g, '$ $1 $')
            .replace(/\\\[(.*?)\\\]/g, '$$ $1 $$')
            .replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
                return `<div class="math-display">$$ ${tex.trim()} $$</div>`;
            })
            .replace(/\$(.*?)\$/g, (match, tex) => {
                return `<span class="math-inline">$ ${tex.trim()} $</span>`;
            });

        // Format bullet points
        content = content.replace(/^\* /gm, '• ');

        // Format headers
        content = content
            .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
            .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
            .replace(/^### (.*?)$/gm, '<h3>$1</h3>');

        // Handle general formatting
        content = content
            .replace(/\n\n/g, '<br><br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Restore code blocks with syntax highlighting
        content = content.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
            const block = codeBlocks[parseInt(index)];
            const formattedCode = block.code
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            return `<pre><code class="language-${block.language}">${formattedCode}</code></pre>`;
        });

        return content;
    }

    // Function to show errors
    function showError(message) {
        const errorDiv = document.getElementById('errorContainer');
        const errorMessage = errorDiv.querySelector('.error-message');
        errorMessage.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    // Add CSS for images
    const style = document.createElement('style');
    style.textContent = `
        .generated-image {
            max-width: 100%;
            height: auto;
            margin: 10px 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .message img {
            display: block;
            max-width: 100%;
            margin: 10px auto;
        }
        
        .message img:hover {
            cursor: pointer;
            transform: scale(1.02);
            transition: transform 0.2s ease;
        }
    `;
    document.head.appendChild(style);

    // Add styles for image button
    const imageButtonStyle = document.createElement('style');
    imageButtonStyle.textContent = `
        #imageButton {
            background-color: #4a9d57;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }

        #imageButton:hover {
            background-color: #3c8746;
        }

        #imageButton:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }

        #imageButton span {
            font-size: 16px;
        }
    `;
    document.head.appendChild(imageButtonStyle);

    // Add MathJax styles
    const mathJaxStyle = document.createElement('style');
    mathJaxStyle.textContent = `
        .math-display {
            overflow-x: auto;
            margin: 1em 0;
            padding: 1em;
            background: rgba(0, 0, 0, 0.03);
            border-radius: 4px;
        }
        
        .math-inline {
            padding: 0 0.2em;
        }
        
        .message .MathJax {
            color: inherit;
        }
    `;
    document.head.appendChild(mathJaxStyle);

    // Speech synthesis using Deepgram
    async function speakText(text) {
        try {
            const speakButton = document.getElementById('speakButton');
            
            // If already speaking, stop it
            if (isSpeaking) {
                if (currentAudio) {
                    currentAudio.pause();
                    currentAudio.currentTime = 0;
                }
                isSpeaking = false;
                speakButton.innerHTML = '<span>🔊</span> Speak Response';
                return;
            }

            // Clean the text before sending to Deepgram
            const cleanText = text.replace(/```[\s\S]*?```/g, '')
                                 .replace(/`.*?`/g, '')
                                 .replace(/\[.*?\]/g, '')
                                 .replace(/\(.*?\)/g, '')
                                 .replace(/#+\s/g, '')
                                 .replace(/\*\*/g, '')
                                 .replace(/\*/g, '');

            // Get Deepgram API key from KV
            const response = await fetch('/api/get-deepgram-key');
            const { key } = await response.json();

            if (!key) {
                throw new Error('Deepgram API key not found');
            }

            // Call Deepgram TTS API
            const ttsResponse = await fetch('https://api.deepgram.com/v1/speak', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: cleanText,
                    voice: 'nova',
                    rate: 1.0,
                    pitch: 1.0
                })
            });

            if (!ttsResponse.ok) {
                throw new Error('Failed to generate speech');
            }

            const audioBlob = await ttsResponse.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Create and play audio
            currentAudio = new Audio(audioUrl);
            currentAudio.addEventListener('ended', () => {
                isSpeaking = false;
                speakButton.innerHTML = '<span>🔊</span> Speak Response';
                URL.revokeObjectURL(audioUrl);
            });

            // Update button state and play
            isSpeaking = true;
            speakButton.innerHTML = '<span>⏹</span> Stop Speaking';
            await currentAudio.play();

        } catch (error) {
            console.error('Speech synthesis error:', error);
            alert('Failed to generate speech. Please try again.');
            isSpeaking = false;
            const speakButton = document.getElementById('speakButton');
            speakButton.innerHTML = '<span>🔊</span> Speak Response';
        }
    }

    // Copy chat functionality
    async function copyChat() {
        const chatContainer = document.getElementById('chatContainer');
        let chatText = '';
        
        // Get all messages
        const messages = chatContainer.getElementsByClassName('message');
        Array.from(messages).forEach(message => {
            // Determine if it's user or AI message
            const isUser = message.classList.contains('user-message');
            const role = isUser ? 'You' : 'Tutor';
            
            // Get message content, handling both text and images
            let content = '';
            if (message.querySelector('img')) {
                content = '[Image]';
            } else {
                // Clean up the text content
                content = message.textContent
                    .replace(/Copy code/g, '') // Remove "Copy code" buttons
                    .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
                    .trim();
            }
            
            // Add to chat text
            if (content) {
                chatText += `${role}: ${content}\n\n`;
            }
        });
        
        // Try using the modern clipboard API first
        try {
            await navigator.clipboard.writeText(chatText);
            showCopySuccess();
        } catch (err) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = chatText;
            
            // Make the textarea invisible but still selectable
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            textArea.style.left = '0';
            textArea.style.top = '0';
            
            document.body.appendChild(textArea);
            
            // Special handling for iOS
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                const range = document.createRange();
                range.selectNodeContents(textArea);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                textArea.setSelectionRange(0, 999999);
            } else {
                textArea.select();
            }
            
            try {
                document.execCommand('copy');
                showCopySuccess();
            } catch (err) {
                console.error('Failed to copy:', err);
                showCopyError();
            }
            
            document.body.removeChild(textArea);
        }
    }

    // Show copy success message with toast
    function showCopySuccess() {
        // Update button state
        const copyButton = document.getElementById('copyButton');
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<span>✓</span> Copied!';
        
        // Show toast notification
        showToast('Chat copied to clipboard!', 'success');
        
        // Reset button after delay
        setTimeout(() => {
            copyButton.innerHTML = originalText;
        }, 2000);
    }

    // Show copy error message
    function showCopyError() {
        showToast('Failed to copy chat. Please try again.', 'error');
    }

    // Toast notification system
    function showToast(message, type = 'success') {
        // Remove existing toast if any
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            document.body.removeChild(existingToast);
        }
        
        // Create new toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add toast styles if not already added
        if (!document.getElementById('toastStyles')) {
            const style = document.createElement('style');
            style.id = 'toastStyles';
            style.textContent = `
                .toast {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 12px 24px;
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    z-index: 10000;
                    animation: toast-fade 2s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                
                .toast-success {
                    background-color: #4CAF50;
                }
                
                .toast-error {
                    background-color: #f44336;
                }
                
                @keyframes toast-fade {
                    0% { opacity: 0; transform: translate(-50%, 20px); }
                    10% { opacity: 1; transform: translate(-50%, 0); }
                    90% { opacity: 1; transform: translate(-50%, 0); }
                    100% { opacity: 0; transform: translate(-50%, -20px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add to document and remove after animation
        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 2000);
    }

    // Event listeners for buttons
    document.addEventListener('DOMContentLoaded', () => {
        // ... existing DOMContentLoaded code ...

        // Add speak button handler
        const speakButton = document.getElementById('speakButton');
        if (speakButton) {
            speakButton.addEventListener('click', () => {
                const messages = document.getElementsByClassName('ai-message');
                if (messages.length > 0) {
                    const lastMessage = messages[messages.length - 1];
                    speakText(lastMessage.textContent);
                }
            });
        }

        // Add copy button handler
        const copyButton = document.getElementById('copyButton');
        if (copyButton) {
            copyButton.addEventListener('click', copyChat);
        }
    });

    // Loading state functions
    function showLoading() {
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) loadingDiv.style.display = 'block';
    }

    function hideLoading() {
        const loadingDiv = document.getElementById('loading');
        if (loadingDiv) loadingDiv.style.display = 'none';
    }
}); 