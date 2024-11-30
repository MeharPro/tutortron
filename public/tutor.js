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

    // Add image upload UI and handlers
    addImageUploadUI();
    
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
        imageUpload.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleImageUpload(e.target.files[0]);
                e.target.value = '';
            }
        });
    }
}); 