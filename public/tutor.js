console.log('tutor.js loaded');
document.addEventListener("DOMContentLoaded", async () => {
    await window.envLoaded;
    
    // Add MathJax configuration
    window.MathJax = {
        tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']],
            processEscapes: true
        },
        svg: {
            fontCache: 'global'
        }
    };

    // Load MathJax
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    script.async = true;
    document.head.appendChild(script);

    // Add CSS for math content
    const style = document.createElement('style');
    style.textContent = `
        .message {
            margin: 10px 0;
            padding: 15px;
            border-radius: 8px;
            max-width: 80%;
            word-wrap: break-word;
        }

        .user-message {
            background-color: #e9ecef;
            margin-left: auto;
            color: #000;
        }

        .ai-message {
            background-color: #f8f9fa;
            margin-right: auto;
            color: #000;
        }

        .math-content {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            padding: 20px;
            background: #ffffff;
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            margin: 10px 0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .math-content h1 {
            color: #1a73e8;
            font-size: 1.5em;
            margin-bottom: 15px;
            border-bottom: 2px solid #1a73e8;
            padding-bottom: 5px;
        }

        .math-content h2 {
            color: #202124;
            font-size: 1.2em;
            margin: 15px 0 10px 0;
            font-weight: 500;
        }

        .math-content code {
            background: #f1f3f4;
            padding: 3px 6px;
            border-radius: 4px;
            font-family: 'Roboto Mono', monospace;
            font-size: 0.9em;
        }

        .math-content .boxed {
            border: 2px solid #1a73e8;
            padding: 10px 15px;
            margin: 10px 0;
            display: inline-block;
            border-radius: 4px;
            background: #f8f9fa;
        }

        .math-content strong {
            color: #202124;
            font-weight: 600;
        }

        .math-content p {
            margin: 8px 0;
            line-height: 1.6;
        }

        .math-content ul, .math-content ol {
            margin: 8px 0 8px 20px;
            padding-left: 15px;
        }

        .math-content li {
            margin: 4px 0;
        }

        .math-content .katex {
            font-size: 1.1em;
        }

        #chatContainer {
            padding: 20px;
            height: calc(100vh - 180px);
            overflow-y: auto;
            background: #ffffff;
        }

        #messageInput {
            width: 100%;
            padding: 12px;
            border: 1px solid #dadce0;
            border-radius: 8px;
            font-size: 16px;
            resize: none;
            min-height: 40px;
            max-height: 200px;
            margin: 10px 0;
        }

        #sendMessage, .image-button {
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            background: #1a73e8;
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        }

        #sendMessage:hover, .image-button:hover {
            background: #1557b0;
        }

        .image-button {
            margin-right: 10px;
        }
    `;
    document.head.appendChild(style);

    const pathParts = window.location.pathname.split('/');
    const mode = pathParts[pathParts.length - 2];  // Get mode from URL
    const linkId = pathParts[pathParts.length - 1];
    
    // Define the vision model constant
    const VISION_MODEL = "meta-llama/llama-3.2-90b-vision-instruct:free";
    
    const models = [
        VISION_MODEL, // Use the constant here
        "google/learnlm-1.5-pro-experimental:free",
        "openchat/openchat-7b:free",
        "liquid/lfm-40b:free",
        "google/gemini-exp-1121:free",
        "google/gemma-2-9b-it:free",
        "meta-llama/llama-3.1-405b-instruct:free",
        "qwen/qwen-2-7b-instruct:free"
    ];

    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    const loadingDiv = document.getElementById('loading');
    
    const conversationHistory = [];
    let isSpeaking = false;
    let currentSpeech = null;
    
    let consoleErrors = [];
    let isProcessing = false;  // Flag to prevent multiple simultaneous requests

    // Override console.error to capture errors
    const originalConsoleError = console.error;
    console.error = function() {
        consoleErrors.push(Array.from(arguments).join(' '));
        originalConsoleError.apply(console, arguments);
        updateErrorButton();
    };

    // Function to update error button visibility
    function updateErrorButton() {
        const button = document.getElementById('floatingErrorButton');
        if (consoleErrors.length > 0) {
            button.classList.add('has-errors');
        } else {
            button.classList.remove('has-errors');
        }
    }

    try {
        const response = await fetch(`/api/tutor/${linkId}`);
        if (!response.ok) {
            window.location.href = '/invalid-link.html';
            return;
        }
        
        const tutorConfig = await response.json();
        document.getElementById('subjectTitle').textContent = tutorConfig.subject;
        
        // Use the mode-specific system prompt
        const systemMessage = `You are an AI teacher named "Tutor-Tron". ${tutorConfig.prompt}`;
        conversationHistory.push({ role: "system", content: systemMessage });
        
        // Execute the initial prompt
        try {
            loadingDiv.style.display = 'block';
            let currentModelIndex = 0;
            let success = false;

            while (currentModelIndex < models.length && !success) {
                try {
                    console.log(`Trying model: ${models[currentModelIndex]}`);
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
                        console.log(`Model ${models[currentModelIndex]} failed, trying next...`);
                        currentModelIndex++;
                        continue;
                    }

                    const data = await response.json();
                    const aiMessage = data.choices[0].message.content;
                    conversationHistory.push({ role: "assistant", content: aiMessage });
                    appendMessage('ai', aiMessage);
                    success = true;

                } catch (error) {
                    console.log(`Error with model ${models[currentModelIndex]}, trying next...`);
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

        // Function to create and append a message
        function appendMessage(type, content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}-message`;
            
            if (type === 'ai') {
                // Check if content contains math markers
                const hasMath = content.includes('\\') || content.includes('$') || 
                              content.includes('\\boxed') || content.includes('\\frac');
                
                if (hasMath) {
                    messageDiv.className += ' math-content';
                }

                // First, handle code blocks separately
                content = content.replace(/```(\w+)?\s*([\s\S]*?)```/g, (match, lang, code) => {
                    const cleanCode = code.trim()
                        .replace(/^\n+|\n+$/g, '')
                        .replace(/\t/g, '    ');
                    
                    let language = (lang || 'text').toLowerCase();
                    if (language === 'c++') language = 'cpp';
                    
                    return `<pre><code class="language-${language}">${cleanCode}</code></pre>`;
                });

                // Then handle other markdown elements
                content = content
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/`([^`]+)`/g, '<code>$1</code>')
                    .replace(/^\* (.+)$/gm, '<li>$1</li>')
                    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
                    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
                    .replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>')
                    .split('\n\n')
                    .map(p => !p.includes('<pre>') ? `<p>${p}</p>` : p)
                    .join('');
                
                messageDiv.innerHTML = content;
                
                if (hasMath && window.MathJax) {
                    window.MathJax.typesetPromise([messageDiv]).catch((err) => 
                        console.error('MathJax error:', err)
                    );
                }

                highlightCode(messageDiv);
            } else {
                messageDiv.textContent = content;
            }
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        // Handle sending messages
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Function to try different models
        async function tryModels(messages, currentModelIndex = 0) {
            if (currentModelIndex >= models.length) {
                throw new Error('All models failed');
            }

            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${window.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: models[currentModelIndex],
                        messages: messages,
                    }),
                });

                if (!response.ok) {
                    // If this model fails, try the next one
                    console.log(`Model ${models[currentModelIndex]} failed, trying next model...`);
                    return tryModels(messages, currentModelIndex + 1);
                }

                const data = await response.json();
                return data.choices[0].message.content;
            } catch (error) {
                // If this model errors, try the next one
                console.log(`Error with model ${models[currentModelIndex]}, trying next model...`);
                return tryModels(messages, currentModelIndex + 1);
            }
        }

        // Modify the sendMessage function
        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;

            appendMessage('user', message);
            messageInput.value = '';
            messageInput.style.height = 'auto';

            try {
                if (currentImage) {
                    console.log("Processing image request...");
                    
                    const visionMessages = [
                        { 
                            role: "system", 
                            content: "You are Tutor-Tron, an AI that can see and analyze images. Help the user understand the image content and answer their questions about it."
                        },
                        {
                            role: "user",
                            content: [
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:image/jpeg;base64,${currentImage}`,
                                        detail: "low"
                                    }
                                },
                                {
                                    type: "text",
                                    text: message
                                }
                            ]
                        }
                    ];

                    try {
                        const aiMessage = await tryVisionModel(visionMessages);
                        
                        // Add to history and display
                        conversationHistory.push({
                            role: "user",
                            content: `[Image uploaded] ${message}`
                        });
                        conversationHistory.push({ 
                            role: "assistant", 
                            content: aiMessage 
                        });
                        
                        appendMessage('ai', aiMessage);
                        
                    } catch (error) {
                        console.error("Vision model error:", error);
                        appendMessage('error', `Failed to process image: ${error.message}`);
                    }

                    // Reset image state
                    currentImage = null;
                    imageButton.style.backgroundColor = '';
                    imageButton.textContent = 'Add Image';
                    imageInput.value = '';
                    
                } else {
                    // No image - use regular models with retry logic
                    let success = false;
                    let retries = 0;
                    
                    // Add text-only message to history
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
                console.error('Error:', error);
                showError('Failed to get response from AI. Please try again.');
            }
        }

    } catch (error) {
        window.location.href = '/invalid-link.html';
        return;
    }

    // Add this after your existing event listeners
    document.getElementById('copyButton').addEventListener('click', () => {
        // Get all messages
        const messages = Array.from(chatContainer.children).map(msg => {
            const role = msg.classList.contains('user-message') ? 'You' : 'Tutor';
            return `${role}: ${msg.textContent}`;
        });

        // Format the chat history
        const chatText = messages.join('\n\n');
        
        // Copy to clipboard
        navigator.clipboard.writeText(chatText).then(() => {
            // Show notification
            const notification = document.createElement('div');
            notification.className = 'copy-notification';
            notification.textContent = 'Chat copied to clipboard!';
            document.body.appendChild(notification);
            
            // Show and animate the notification
            notification.style.display = 'block';
            
            // Remove notification after animation
            setTimeout(() => {
                notification.remove();
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            showError('Failed to copy chat to clipboard');
        });
    });

    // Replace the speak function with this:
    async function speak(text) {
        const DEEPGRAM_URL = "https://api.deepgram.com/v1/speak?model=aura-arcas-en";
        const DEEPGRAM_API_KEY = window.env.DEEPGRAM_API_KEY;

        console.log('Using Deepgram API Key:', DEEPGRAM_API_KEY); // Debug log

        const payload = {
            text: text
        };

        try {
            const response = await fetch(DEEPGRAM_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Token ${DEEPGRAM_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('Text-to-speech request failed:', errorData);
                throw new Error('Failed to convert text to speech');
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
            console.error('Error during text-to-speech request:', error);
            isSpeaking = false;
            updateSpeakButton();
        }
    }

    // Update the speakButton click handler
    document.getElementById('speakButton').addEventListener('click', () => {
        if (isSpeaking) {
            // Stop speaking
            if (currentSpeech) {
                currentSpeech.pause();
                currentSpeech = null;
            }
            isSpeaking = false;
            updateSpeakButton();
        } else {
            // Start speaking - get the last AI message
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

    // Add this function
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

    // Add this right after getting the mode
    document.body.classList.add(mode); // Add this line to set the background color
    document.getElementById('modeTitle').textContent = 
        `${mode.charAt(0).toUpperCase() + mode.slice(1)} - Tutor-Tron`;

    // Add this function to handle error reporting
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

    // Update error display to include report button
    function showError(message) {
        const errorContainer = document.getElementById('errorContainer');
        const errorMessage = errorContainer.querySelector('.error-message');
        errorMessage.textContent = message;
        errorContainer.style.display = 'block';

        // Add click handler for report button
        document.getElementById('reportError').onclick = () => reportError(message);
    }

    // Add right after the message input declarations (around line 22)
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.style.display = 'none';

    const imageButton = document.createElement('button');
    imageButton.textContent = 'Add Image';
    imageButton.className = 'image-button';
    messageInput.parentNode.insertBefore(imageButton, sendButton);
    messageInput.parentNode.insertBefore(imageInput, sendButton);

    let currentImage = null;

    imageButton.addEventListener('click', () => imageInput.click());

    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit instead of 2MB
                alert('Image is too large. Please use an image under 1MB.');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64Full = e.target.result;
                currentImage = base64Full.split(',')[1];
                console.log("Image format:", file.type);
                console.log("Image size:", file.size);
                console.log("Base64 length:", currentImage.length);
                imageButton.style.backgroundColor = '#4F46E5';
                imageButton.textContent = 'Image Added';
            };
            reader.readAsDataURL(file);
        }
    });

    const VISION_MODELS = [
        "meta-llama/llama-3.2-90b-vision-instruct:free"
    ];

    const TEXT_MODELS = [
        "google/learnlm-1.5-pro-experimental:free",
        "openchat/openchat-7b:free",
        "liquid/lfm-40b:free",
        "google/gemini-exp-1121:free",
        "google/gemma-2-9b-it:free",
        "meta-llama/llama-3.1-405b-instruct:free",
        "qwen/qwen-2-7b-instruct:free"
    ];

    // Helper function to delay execution
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Helper function to try vision models with retry
    async function tryVisionModel(visionMessages, retryCount = 0) {
        for (const model of VISION_MODELS) {
            try {
                console.log(`Attempting vision model: ${model}, attempt ${retryCount + 1}`);
                
                // Simplify the request to match the Python implementation
                const requestBody = {
                    model: model,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: visionMessages[1].content[1].text
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
                };

                console.log("Request body:", JSON.stringify(requestBody, null, 2));

                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${window.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(requestBody)
                });

                const responseText = await response.text();
                console.log(`Raw response from ${model}:`, responseText);

                if (!response.ok) {
                    const errorData = JSON.parse(responseText);
                    if (errorData.error?.code === 429 && retryCount < 3) {
                        const waitTime = Math.pow(2, retryCount) * 1000;
                        console.log(`Rate limit hit, waiting ${waitTime}ms before retry...`);
                        await delay(waitTime);
                        return tryVisionModel(visionMessages, retryCount + 1);
                    }
                    throw new Error(`Model ${model} failed: ${responseText}`);
                }

                const data = JSON.parse(responseText);
                
                if (data.choices?.[0]?.error) {
                    console.error(`Error from ${model}:`, data.choices[0].error);
                    continue;
                }

                if (!data.choices?.[0]?.message?.content?.trim()) {
                    console.error(`Empty response from ${model}`);
                    continue;
                }

                return data.choices[0].message.content.trim();
            } catch (error) {
                console.error(`Error with ${model}:`, error);
            }
        }
        throw new Error('All vision models failed');
    }

    // Add a helper function for formatting mathematical responses
    function formatMathResponse(steps) {
        return `
# Problem Analysis
${steps.problem}

# Step-by-Step Solution
${steps.steps.map((step, index) => `## Step ${index + 1}: ${step}`).join('\n\n')}

# Final Answer
${steps.answer}
`;
    }

    // Example usage in your message handling
    function createMathResponse() {
        const mathSteps = {
            problem: `Let's solve the equation: 
\`3 tan(x) - 2 tan(x) / (1 - tan²(x)) = 0\`

This equation involves:
• Trigonometric function tan(x)
• Rational expressions
• Variable x`,

            steps: [
                `**Simplify the Equation**
\`3 tan(x) - \\frac{2 tan(x)}{1 - tan²(x)} = 0\``,

                `**Factor out tan(x)**
\`tan(x) \\left(3 - \\frac{2}{1 - tan²(x)}\\right) = 0\``,

                `**Find First Solution**
Setting \`tan(x) = 0\` gives us \`x = 0\` as our first solution.`,

                `**Solve the Other Factor**
\`3 - \\frac{2}{1 - tan²(x)} = 0\`
Simplify to: \`\\frac{2}{1 - tan²(x)} = 3\`
Then: \`2 = 3 - 3tan²(x)\``,

                `**Solve for tan²(x)**
\`3tan²(x) = 1\`
Therefore: \`tan²(x) = \\frac{1}{3}\``,

                `**Find tan(x)**
Taking the square root:
\`tan(x) = ±\\frac{1}{\\sqrt{3}}\``,

                `**Find All Solutions**
For \`tan(x) = \\frac{1}{\\sqrt{3}}\`: \`x = \\frac{π}{6} + kπ\`
For \`tan(x) = -\\frac{1}{\\sqrt{3}}\`: \`x = -\\frac{π}{6} + kπ\`
Where k is an integer.`
            ],

            answer: `**Final Answer:** \`\\boxed{x = 0, \\frac{π}{6}, -\\frac{π}{6}}\`

Note: These are the principal solutions in the interval \`[-π, π]\`.`
        };

        return formatMathResponse(mathSteps);
    }

    // Add this to your message handling logic
    function appendMathMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message math-content`;
        
        // Add MathJax processing
        if (type === 'ai') {
            messageDiv.innerHTML = content;
            if (window.MathJax) {
                window.MathJax.typesetPromise([messageDiv]).catch((err) => console.error('MathJax error:', err));
            }
        } else {
            messageDiv.textContent = content;
        }
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}); 