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

    // Get configuration from window.TUTOR_CONFIG
    const { subject, prompt, mode } = window.TUTOR_CONFIG;
    
    // Set mode-specific styling
    document.body.classList.add(mode.toLowerCase());
    
    // Initialize conversation with the prompt
    if (prompt) {
        const systemMessage = {
            role: "system",
            content: `You are a tutor helping a student with ${subject}. ${prompt}`
        };
        conversationHistory.push(systemMessage);
        
        // Display welcome message
        appendMessage('ai', `Welcome! I'm here to help you with ${subject}. Let's begin!`);
    }

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
        "google/learnlm-1.5-pro-experimental:free",
        "meta-llama/llama-3.2-90b-vision-instruct:free",
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
            'C#': 'csharp',
            'html': 'html',
            'HTML': 'html',
            'css': 'css',
            'CSS': 'css',
            'sql': 'sql',
            'SQL': 'sql',
            'bash': 'bash',
            'sh': 'bash',
            'shell': 'bash',
            'typescript': 'typescript',
            'ts': 'typescript',
            'TypeScript': 'typescript'
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

        // Format double ## at start of line to make entire line bold
        content = content.replace(/^##\s*(.*?)$/gm, '<strong>$1</strong>');

        // Handle general formatting
        content = content
            .replace(/\n\n/g, '<br><br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

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

    // Helper function to escape HTML special characters
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function appendMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        if (type === 'ai') {
            // Format code blocks first
            content = formatMathContent(content);

            // Create a wrapper for the content
            const wrapper = document.createElement('div');
            wrapper.className = 'message-content';

            // Split content into paragraphs and handle each one
            const paragraphs = content.split('<br><br>');
            paragraphs.forEach(paragraph => {
                if (paragraph.includes('<pre><code')) {
                    // If it's a code block, add it directly
                    wrapper.innerHTML += paragraph;
                } else {
                    // If it's regular text, wrap in paragraph div
                    wrapper.innerHTML += `<div class="paragraph">${paragraph}</div>`;
                }
            });

            messageDiv.appendChild(wrapper);
            
            // Process MathJax
            if (mathJaxReady && window.MathJax?.typesetPromise) {
                window.MathJax.typesetPromise([messageDiv]).catch(err => 
                    console.error('MathJax error:', err)
                );
            }

            // Initialize syntax highlighting for code blocks
            messageDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        } else {
            messageDiv.textContent = content;
        }
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Add syntax highlighting styles
    const codeStyle = document.createElement('style');
    codeStyle.textContent = `
        .message-content {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .paragraph {
            margin: 0;
            line-height: 1.5;
        }
        pre {
            background-color: #1e1e1e;
            border-radius: 6px;
            padding: 12px;
            margin: 0;
            overflow-x: auto;
            width: 100%;
        }
        code {
            font-family: 'Fira Code', monospace;
            font-size: 14px;
            line-height: 1.5;
            width: 100%;
            display: inline-block;
        }
        .hljs {
            background: #1e1e1e;
            color: #808080;
            padding: 0;
        }
        /* Special text colors */
        .hljs-keyword {
            color: #569cd6;  /* blue for keywords like while, for, if */
        }
        .hljs-title {
            color: #4ec9b0;  /* teal for titles/functions */
        }
        .hljs-string {
            color: #ce9178;  /* orange for strings */
        }
        .hljs-comment {
            color: #6a9955;  /* green for comments */
        }
        .hljs-literal {
            color: #569cd6;  /* blue for true/false */
        }
        .hljs-built_in {
            color: #4ec9b0;  /* teal for built-in functions */
        }
        .hljs-params {
            color: #9cdcfe;  /* light blue for parameters */
        }
        .hljs-number {
            color: #b5cea8;  /* light green for numbers */
        }
        .hljs-operator {
            color: #d4d4d4;  /* white for operators */
        }
        /* Additional styles for markdown-like syntax */
        .hljs-section {
            color: #808080;  /* grey for markdown sections */
        }
        .hljs-emphasis {
            color: #6a9955;  /* green for emphasized text */
            font-style: italic;
        }
        .hljs-strong {
            color: #569cd6;  /* blue for strong text */
        }
    `;
    document.head.appendChild(codeStyle);

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
                imageButton.style.backgroundColor = '#22c55e';
                imageButton.style.color = '#ffffff';
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

    document.getElementById('copyButton').addEventListener('click', async () => {
        const messages = Array.from(chatContainer.children).map(msg => {
            const role = msg.classList.contains('user-message') ? 'You' : 'Tutor';
            return `${role}: ${msg.textContent}`;
        });
        
        const chatText = messages.join('\n\n');
        
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(chatText);
                showCopyNotification('Chat copied to clipboard!');
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = chatText;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    textArea.remove();
                    showCopyNotification('Chat copied to clipboard!');
                } catch (err) {
                    console.error('Fallback copy failed:', err);
                    textArea.remove();
                    throw new Error('Copy failed');
                }
            }
        } catch (err) {
            console.error('Failed to copy:', err);
            showError('Failed to copy chat to clipboard');
        }
    });

    function showCopyNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = '#22c55e';
        notification.style.color = 'white';
        notification.style.padding = '12px 24px';
        notification.style.borderRadius = '6px';
        notification.style.zIndex = '1000';
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }

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