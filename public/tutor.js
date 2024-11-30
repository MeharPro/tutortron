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
    let currentImage = null;
    let isSpeaking = false;
    let currentSpeech = null;
    let consoleErrors = [];
    let isProcessing = false;
    let mathJaxReady = false;

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

            // Get initial response from AI
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeys.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://tutortron.dizon-dzn12.workers.dev/',
                    'X-Title': 'Tutor-Tron'
                },
                body: JSON.stringify({
                    model: mode === 'codebreaker' ? 'google/gemini-pro' : 'anthropic/claude-3-sonnet-vision',
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
    async function handleSendMessage(isImageMessage = false) {
        if (isProcessing || (!isImageMessage && !messageInput.value.trim())) return;
        
        const userMessage = isImageMessage ? '' : messageInput.value.trim();
        if (!isImageMessage) {
            messageInput.value = '';
        }
        
        if (!isImageMessage) {
            appendMessage('user', userMessage);
        }
        
        isProcessing = true;
        if (loadingDiv) loadingDiv.style.display = 'block';
        
        try {
            if (!isImageMessage) {
                // Add user message to history
                conversationHistory.push({
                    role: "user",
                    content: userMessage
                });
            }
            
            // Get AI response
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKeys.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://tutortron.dizon-dzn12.workers.dev/',
                    'X-Title': 'Tutor-Tron'
                },
                body: JSON.stringify({
                    model: mode === 'codebreaker' ? 'google/gemini-pro' : 'anthropic/claude-3-sonnet-vision',
                    messages: conversationHistory,
                    temperature: 0.7,
                    max_tokens: 400
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to get AI response');
            }
            
            const data = await response.json();
            const aiMessage = data.choices[0].message.content;
            
            // Add AI's response to history
            conversationHistory.push({
                role: "assistant",
                content: aiMessage
            });
            
            // Display the AI's response
            appendMessage('ai', aiMessage);
        } catch (error) {
            console.error('Error getting AI response:', error);
            showError('Failed to get response from tutor. Please try again.');
        } finally {
            isProcessing = false;
            if (loadingDiv) loadingDiv.style.display = 'none';
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

    // Speech synthesis functionality
    function speakText(text) {
        // Remove code blocks and other markdown before speaking
        const cleanText = text.replace(/```[\s\S]*?```/g, '')
                             .replace(/`.*?`/g, '')
                             .replace(/\[.*?\]/g, '')
                             .replace(/\(.*?\)/g, '')
                             .replace(/#+\s/g, '')
                             .replace(/\*\*/g, '')
                             .replace(/\*/g, '');

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Get available voices and set to a natural sounding one if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.name.includes('Samantha') || // iOS/macOS
            voice.name.includes('Google US English Female') || // Chrome
            voice.name.includes('Microsoft Zira') // Windows
        );
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
    }

    // Copy chat functionality
    function copyChat() {
        const chatContainer = document.getElementById('chatContainer');
        let chatText = '';
        
        // Get all messages
        const messages = chatContainer.getElementsByClassName('message');
        Array.from(messages).forEach(message => {
            const role = message.classList.contains('user-message') ? 'You' : 'Tutor';
            const content = message.textContent.trim();
            chatText += `${role}: ${content}\n\n`;
        });
        
        // Use the newer clipboard API with fallback
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(chatText).then(() => {
                showCopySuccess();
            }).catch(() => {
                fallbackCopyToClipboard(chatText);
            });
        } else {
            fallbackCopyToClipboard(chatText);
        }
    }

    // Fallback copy method for mobile devices
    function fallbackCopyToClipboard(text) {
        // Create a temporary textarea
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        
        // Handle iOS specific issues
        textArea.contentEditable = true;
        textArea.readOnly = false;
        
        // Select the text and copy
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        textArea.setSelectionRange(0, text.length);
        
        try {
            document.execCommand('copy');
            showCopySuccess();
        } catch (err) {
            console.error('Failed to copy chat:', err);
            alert('Failed to copy chat. Please try again.');
        } finally {
            document.body.removeChild(textArea);
        }
    }

    // Show copy success message
    function showCopySuccess() {
        const copyButton = document.getElementById('copyButton');
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<span>✓</span> Copied!';
        setTimeout(() => {
            copyButton.innerHTML = originalText;
        }, 2000);
    }

    // Initialize speech synthesis
    function initSpeechSynthesis() {
        // Load voices when they're available (needed for Chrome)
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => {
                window.speechSynthesis.getVoices();
            };
        }
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

        // Initialize speech synthesis
        initSpeechSynthesis();
    });
}); 