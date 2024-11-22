console.log('tutor.js loaded');
document.addEventListener("DOMContentLoaded", async () => {
    // Get the link ID from the URL
    const pathParts = window.location.pathname.split('/');
    const linkId = pathParts[pathParts.length - 1];
    const model = "meta-llama/llama-3.1-405b-instruct:free";

    // Get the chat container and message input
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');
    const loadingDiv = document.getElementById('loading');
    
    // Conversation history
    const conversationHistory = [];
    
    // Add these variables at the top of your DOMContentLoaded event listener
    let isSpeaking = false;
    let currentSpeech = null;
    
    try {
        // Fetch the tutor configuration for this link
        const response = await fetch(`/api/tutor/${linkId}`);
        if (!response.ok) {
            window.location.href = '/invalid-link.html';
            return;
        }
        
        const tutorConfig = await response.json();
        
        // Update the page with the subject
        document.getElementById('subjectTitle').textContent = tutorConfig.subject;
        
        // Add system message to conversation history
        const systemMessage = `You are a high school teacher named Tutor Tron, specializing in ${tutorConfig.subject}. ${tutorConfig.prompt}`;
        conversationHistory.push({ role: "system", content: systemMessage });
        
        // Initialize the chat with the AI's greeting
        appendMessage('ai', `Hello! I'm your AI tutor for ${tutorConfig.subject}. How can I help you today?`);
        
        // Handle sending messages
        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;

            // Disable input while processing
            messageInput.value = '';
            messageInput.disabled = true;
            sendButton.disabled = true;
            loadingDiv.style.display = 'block';

            // Display user message
            appendMessage('user', message);
            conversationHistory.push({ role: "user", content: message });

            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${window.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: conversationHistory,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const aiMessage = data.choices[0].message.content;
                    conversationHistory.push({ role: "assistant", content: aiMessage });
                    appendMessage('ai', aiMessage);
                } else {
                    appendMessage('error', 'Sorry, I encountered an error. Please try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                appendMessage('error', 'Sorry, I encountered an error. Please try again.');
            } finally {
                messageInput.disabled = false;
                sendButton.disabled = false;
                loadingDiv.style.display = 'none';
                messageInput.focus();
                
                // If speaking is enabled, speak the new response
                if (isSpeaking) {
                    const aiMessages = Array.from(chatContainer.children)
                        .filter(msg => msg.classList.contains('ai-message'));
                    if (aiMessages.length > 0) {
                        const lastMessage = aiMessages[aiMessages.length - 1].textContent;
                        speak(lastMessage);
                    }
                }
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

        // Cancel any ongoing speech
        if (currentSpeech) {
            currentSpeech.pause();
            currentSpeech = null;
        }

        const payload = {
            text: text
        };

        const headers = {
            "Authorization": `Token ${DEEPGRAM_API_KEY}`,
            "Content-Type": "application/json"
        };

        try {
            const response = await fetch(DEEPGRAM_URL, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);

                // Play the audio
                const audio = new Audio(audioUrl);
                currentSpeech = audio;
                
                audio.onended = () => {
                    isSpeaking = false;
                    updateSpeakButton();
                    currentSpeech = null;
                };

                audio.play();
            } else {
                console.error("Text-to-speech request failed:", await response.text());
                isSpeaking = false;
                updateSpeakButton();
            }
        } catch (error) {
            console.error("Error during text-to-speech request:", error);
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
});

function appendMessage(type, content) {
    const chatContainer = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = content;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
} 