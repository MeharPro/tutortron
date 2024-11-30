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

    // Message handling functions
    async function handleSendMessage() {
        if (isProcessing || !messageInput.value.trim()) return;
        
        const userMessage = messageInput.value.trim();
        messageInput.value = '';
        
        appendMessage('user', userMessage);
        
        isProcessing = true;
        if (loadingDiv) loadingDiv.style.display = 'block';
        
        try {
            // Add user message to history
            conversationHistory.push({
                role: "user",
                content: userMessage
            });
            
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
                throw new Error(`API response not ok: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('API Response:', data); // Debug log

            // Handle different response formats
            let aiMessage;
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

    // Function to format content with math and code highlighting
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
            .replace(/\\\[(.*?)\\\]/g, '$$ $1 $$');

        // Format bullet points
        content = content.replace(/^\* /gm, '• ');

        // Format headers
        content = content.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
        content = content.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
        content = content.replace(/^### (.*?)$/gm, '<h3>$1</h3>');

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
}); 