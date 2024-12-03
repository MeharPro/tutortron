async function checkAuth() {
    const token = localStorage.getItem('teacherToken');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            localStorage.removeItem('teacherToken');
            window.location.href = '/index.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('teacherToken');
        window.location.href = '/index.html';
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await checkAuth();
    const token = localStorage.getItem('teacherToken');

    // Mode tabs functionality
    const modeTabs = document.querySelectorAll('.mode-tab');
    const modePanels = document.querySelectorAll('.mode-panel');

    modeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            modeTabs.forEach(t => t.classList.remove('active'));
            modePanels.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const mode = tab.dataset.mode;
            document.getElementById(`${mode}-panel`).classList.add('active');
        });
    });

    // Add models list at the top
    const models = [
        "google/learnlm-1.5-pro-experimental:free",
        "meta-llama/llama-3.1-405b-instruct:free",
        "meta-llama/llama-3.1-70b-instruct:free",
        "liquid/lfm-40b:free",
        "google/gemini-exp-1114",
        "google/gemma-2-9b-it:free",
        "qwen/qwen-2-7b-instruct:free"
    ];

    // System prompts for each mode
    const systemPrompt = {
        investigator: 
        "You are crafting a teaching prompt for an AI model. Transform the given topic into a structured learning experience that:\n" +
        "1. Breaks down complex concepts into fundamental building blocks\n" +
        "2. Incorporates specific real-world examples and applications\n" +
        "3. Builds knowledge progressively from basic to advanced concepts\n" +
        "4. Includes targeted comprehension checks at key points\n" +
        "5. Uses the Socratic method to guide understanding\n\n" +
        "Format your prompt to explicitly instruct the AI to:\n" +
        "- Begin with foundational definitions\n" +
        "- Be concise and to the point\n" +
        "- Stay relevant to the topic, even if the user's input is off-topic\n" +
        "- Connect concepts to practical applications\n" +
        "- Include periodic knowledge validation\n" +
        "- Ask probing follow-up questions that:\n" +
        "  * Clarify student misconceptions\n" +
        "  * Deepen conceptual understanding\n" +
        "  * Bridge gaps in knowledge\n" +
        "  * Challenge assumptions\n\n" +
        "IMPORTANT: Return only the teaching prompt, without any meta-commentary or additional responses.",

        comparitor: 
        "You are crafting a comparative analysis prompt for an AI model. Create a structured teaching prompt that:\n" +
        "1. Establishes clear evaluation criteria\n" +
        "2. Uses parallel structure when comparing elements\n" +
        "3. Highlights both obvious and subtle distinctions\n" +
        "4. Examines contextual factors affecting comparisons\n" +
        "5. Identifies practical implications of differences\n\n" +
        "Format your prompt to explicitly instruct the AI to:\n" +
        "- Be concise and to the point\n" +
        "- Stay relevant to the topic, even if the user's input is off-topic\n" +
        "- Begin with clear definitions of all elements being compared\n" +
        "- Use consistent criteria across comparisons\n" +
        "- Include specific examples illustrating key differences\n" +
        "- Incorporate targeted follow-up questions that:\n" +
        "  * Challenge oversimplified comparisons\n" +
        "  * Explore edge cases\n" +
        "  * Reveal hidden similarities\n" +
        "  * Examine practical implications\n\n" +
        "IMPORTANT: Return only the comparative prompt, without any meta-commentary or additional responses.",

        quest: "You are crafting an exploratory learning prompt for an AI model. Create an inquiry-based prompt that:\n" +
        "1. Sparks genuine curiosity about the topic\n" +
        "2. Reveals unexpected connections\n" +
        "3. Encourages creative thinking\n" +
        "4. Leads to deeper investigations\n" +
        "5. Maintains focus while allowing exploration\n\n" +
        "Format your prompt to explicitly instruct the AI to:\n" +
        "- Be concise and to the point\n" +
        "- Stay relevant to the topic, even if the user's input is off-topic\n" +
        "- Start with an intriguing aspect of the topic\n" +
        "- Guide discovery through strategic questioning\n" +
        "- Connect concepts to student interests\n" +
        "- Include follow-up questions that:\n" +
        "  * Encourage hypothesis formation\n" +
        "  * Promote critical thinking\n" +
        "  * Lead to unexpected insights\n" +
        "  * Support natural knowledge expansion\n\n" +
        "IMPORTANT: Limit to five sentences and return only the exploratory prompt.",
        codebreaker: (language) => "You are a prompt writer. Create instructions for a teaching AI that will teach [concept] in " + language + ". Your prompt should make the teaching AI:\n\n" +
    "1. Start with proper setup:\n" +
    " - Introduce itself as an interactive programming tutor named Tutor-Tron\n" +
    " - Encourage questions and interruptions\n" +
    " - Present only one concept per interaction\n\n" +
    "2. Structure each concept introduction as:\n" +
    " - One-sentence definition\n" +
    " - Real-world use case example\n" +
    " - Basic syntax explanation\n" +
    " - Wait for student confirmation\n\n" +
    "3. Guide example presentation:\n" +
    " - Show ONE simple working code example\n" +
    " - Explain each part of the code separately\n" +
    " - Point out common pitfalls\n" +
    " - Ask specific questions about the code\n\n" +
    "4. Create interactive exercises:\n" +
    " - Give ONE clear modification task\n" +
    " - Specify exactly what changes are needed\n" +
    " - Ask student to explain their changes\n" +
    " - Guide reflection on differences\n\n" +
    "5. Teach debugging through:\n" +
    " - One problem at a time\n" +
    " - Progressively harder challenges\n" +
    " - Specific questions about errors\n" +
    " - Guided problem-solving steps\n\n" +
    "The teaching AI should:\n" +
    " - Stop after each major point\n" +
    " - Ask specific, not general questions\n" +
    " - Never show solutions before student attempts\n" +
    " - Analyze student solutions when provided\n" +
    "Remember: Write instructions for the teaching AI, don't create the lesson content yourself.",
 
        eliminator: 
            "You are crafting a knowledge-testing game prompt. Create a clear, elimination-style prompt that instructs the AI to:\n" +
            "1. Start by providing a comprehensive list of items related to the topic, where each item includes:\n" +
            "- Be concise and to the point\n" +
            "   - Name/identifier\n" +
            "   - 2-3 key facts about each item\n" +
            "   - Important contextual information\n\n" +
            "2. Structure the elimination game to:\n" +
            "   - Present a fact/characteristic that applies to all but one item\n" +
            "   - Ask the student to identify the item that doesn't match\n" +
            "   - Remove the identified item and continue with remaining items\n" +
            "   - Progress until only one item remains\n\n" +
            "3. Include instructions for:\n" +
            "  - Stay relevant to the topic, even if the user's input is off-topic\n" +
            "   - Validating each student answer\n" +
            "   - Providing hints if needed\n" +
            "   - Explaining why each elimination was correct\n\n" +
            "Format your response as a direct game instruction, similar to:\n" +
            "'List [items in category] with [specific details]. Then play an elimination game where you present facts that exclude one item at a time. After each correct identification, continue with the remaining items until one remains.'\n\n" +
            "IMPORTANT: Return only the game prompt itself, without any additional commentary or explanation."
    };

    // Function to try different models for prompt refinement
    async function tryModels(systemPrompt, userPrompt, currentModelIndex = 0) {
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
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                }),
            });
            console.log(response)

            if (!response.ok) {
                // If this model fails, try the next one
                console.log(`Model ${models[currentModelIndex]} failed, trying next model...`);
                return tryModels(systemPrompt, userPrompt, currentModelIndex + 1);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            // If this model errors, try the next one
            console.log(`Error with model ${models[currentModelIndex]}, trying next model...`);
            return tryModels(systemPrompt, userPrompt, currentModelIndex + 1);
        }
    }

    // Update the refinePrompt function
    async function refinePrompt(mode, prompt) {
        try {
            let promptTemplate;
            if (mode === 'codebreaker') {
                const language = document.getElementById('codebreakerLanguage').value;
                promptTemplate = systemPrompt.codebreaker(language);
            } else {
                promptTemplate = systemPrompt[mode];
            }

            console.log(`[${mode.toUpperCase()}] Original Prompt:`, prompt);
            console.log(`[${mode.toUpperCase()}] System Template:`, promptTemplate);

            const refinedPrompt = await tryModels(promptTemplate, prompt);
            console.log(`[${mode.toUpperCase()}] Refined Prompt:`, refinedPrompt);

            return refinedPrompt;
        } catch (error) {
            console.error('All models failed:', error);
            return prompt; // Return original prompt if all models fail
        }
    }

    // Update the prompt refinement handler
    ['investigator', 'comparitor', 'quest', 'codebreaker', 'eliminator'].forEach(mode => {
        const promptInput = document.getElementById(`${mode}Prompt`);
        const refinedPromptDiv = document.getElementById(`${mode}RefinedPrompt`);
        
        promptInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const originalPrompt = promptInput.value;
                refinedPromptDiv.textContent = 'Refining prompt...';
                refinedPromptDiv.style.display = 'block';
                
                const refinedPrompt = await refinePrompt(mode, originalPrompt);
                
                // Update both the display div and the input field
                refinedPromptDiv.textContent = refinedPrompt;
                promptInput.value = refinedPrompt;
                
                // Optional: Focus back on the input and move cursor to end
                promptInput.focus();
                promptInput.setSelectionRange(refinedPrompt.length, refinedPrompt.length);
            }
        });
    });

    // Create link functions for each mode
    async function createModeLink(mode, subject, prompt) {
        try {
            const token = localStorage.getItem('teacherToken');
            if (!token) {
                throw new Error('No authentication token found');
            }

            console.log('Creating link with:', { mode, subject, prompt }); // Debug log

            const response = await fetch('/api/links', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    subject,
                    prompt,
                    mode
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData); // Debug log
                throw new Error(errorData.message || 'Failed to create link');
            }

            await window.loadLinks();
            return true;
        } catch (error) {
            console.error(`Error creating ${mode} link:`, error);
            showMessage(`Failed to create link: ${error.message}`, true);
            return false;
        }
    }

    // Add click handlers for each mode's create button
    ['investigator', 'comparitor', 'quest', 'codebreaker', 'eliminator'].forEach(mode => {
        document.getElementById(`create${mode.charAt(0).toUpperCase() + mode.slice(1)}Btn`)
            .addEventListener('click', async () => {
                const subject = document.getElementById(`${mode}Subject`).value.trim();
                const promptInput = document.getElementById(`${mode}Prompt`);
                const useCustomPrompt = document.getElementById(`${mode}Custom`).checked;
                let prompt = promptInput.value.trim();

                if (!subject || !prompt) {
                    showMessage('Please fill in both subject and prompt fields', true);
                    return;
                }

                // Show loading state
                const button = document.getElementById(`create${mode.charAt(0).toUpperCase() + mode.slice(1)}Btn`);
                const originalText = button.textContent;
                button.textContent = useCustomPrompt ? 'Creating Link...' : 'Refining Prompt...';
                button.disabled = true;

                try {
                    // Log the original prompt
                    console.log(`[${mode.toUpperCase()}] Original Prompt:`, prompt);

                    // Refine the prompt unless custom prompt is checked
                    if (!useCustomPrompt) {
                        const systemTemplate = mode === 'codebreaker' 
                            ? systemPrompt.codebreaker(document.getElementById('codebreakerLanguage').value)
                            : systemPrompt[mode];
                        console.log(`[${mode.toUpperCase()}] System Template:`, systemTemplate);
                        prompt = await refinePrompt(mode, prompt);
                        console.log(`[${mode.toUpperCase()}] Refined Prompt:`, prompt);
                    } else {
                        console.log(`[${mode.toUpperCase()}] Using Custom Prompt:`, prompt);
                    }

                    const success = await createModeLink(mode, subject, prompt);
                    if (success) {
                        promptInput.value = '';
                        document.getElementById(`${mode}Subject`).value = '';
                        document.getElementById(`${mode}Custom`).checked = false;
                        showMessage(`${mode.charAt(0).toUpperCase() + mode.slice(1)} link created successfully!`);
                    } else {
                        showMessage('Failed to create link', true);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    showMessage('Failed to process prompt', true);
                } finally {
                    // Restore button state
                    button.textContent = originalText;
                    button.disabled = false;
                }
            });
    });

    // Initial load of links
    await window.loadLinks();

    // Add info icons with tooltips to mode tabs
    const modeInfo = {
        investigator: "Allows the student to investigate a topic in depth.",
        quest: "Allows the student to go above and beyond the topic and create connections.",
        comparitor: "Allows the student to understand key similarities and differences between complex topics.",
        codebreaker: "Applies to learning related to coding, gives the student broken code to debug.",
        eliminator: "A game to understand key facts about multiple topics."
    };

    // Add info icons to each mode tab
    document.querySelectorAll('.mode-tab').forEach(tab => {
        const mode = tab.dataset.mode;
        const infoIcon = document.createElement('span');
        infoIcon.innerHTML = 'i';
        infoIcon.className = 'info-icon';
        infoIcon.style.cssText = `
            cursor: pointer;
            position: relative;
            margin-left: 8px;
            font-size: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background-color: #333;
            color: white;
            font-family: 'Courier New', monospace;
            font-weight: normal;
            line-height: 1;
            transition: all 0.2s ease;
        `;

        // Add hover effect
        infoIcon.addEventListener('mouseenter', () => {
            infoIcon.style.backgroundColor = '#666';
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
        });

        infoIcon.addEventListener('mouseleave', () => {
            infoIcon.style.backgroundColor = '#333';
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
        });

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = modeInfo[mode];
        tooltip.style.cssText = `
            visibility: hidden;
            position: absolute;
            z-index: 1;
            background-color: #333;
            color: white;
            text-align: center;
            padding: 8px 12px;
            border-radius: 6px;
            width: 200px;
            left: 50%;
            transform: translateX(-50%);
            bottom: 125%;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
            white-space: normal;
        `;

        // Add arrow to tooltip
        const arrow = document.createElement('div');
        arrow.style.cssText = `
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: #333 transparent transparent transparent;
        `;
        tooltip.appendChild(arrow);
        infoIcon.appendChild(tooltip);

        // Add touch events for mobile
        infoIcon.addEventListener('touchstart', (e) => {
            e.preventDefault();
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
            infoIcon.style.backgroundColor = '#666';
        });

        infoIcon.addEventListener('touchend', () => {
            setTimeout(() => {
                tooltip.style.visibility = 'hidden';
                tooltip.style.opacity = '0';
                infoIcon.style.backgroundColor = '#333';
            }, 2000);
        });

        tab.appendChild(infoIcon);
    });
});

// Function to show messages
function showMessage(message, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.className = isError ? 'error-message' : 'success-message';
    messageDiv.style.marginTop = '10px';
    document.querySelector('.prompt-form').appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
}

// Update the delete link function
async function deleteLink(linkId) {
    try {
        const token = localStorage.getItem('teacherToken');
        const response = await fetch(`/api/links/${linkId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error:', errorData);
            throw new Error('Failed to delete link');
        }
        
        await window.loadLinks();
        showMessage('Link deleted successfully!');
    } catch (error) {
        console.error('Error deleting link:', error);
        showMessage('Failed to delete link: ' + error.message, true);
    }
}

// Add this at the top with other functions
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                textArea.remove();
                return true;
            } catch (error) {
                textArea.remove();
                return false;
            }
        }
    } catch (error) {
        return false;
    }
}

// Update the loadLinks function's copy button section
window.loadLinks = async function() {
    const token = localStorage.getItem('teacherToken');
    try {
        const response = await fetch('/api/links', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to load links');
        
        const links = await response.json();
        const linksList = document.getElementById('linksList');
        linksList.innerHTML = '';
        
        links.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        links.forEach(link => {
            const linkCard = document.createElement('div');
            linkCard.className = `link-card ${link.mode || 'investigator'}`;
            const fullUrl = `${window.location.origin}/${link.mode || 'investigator'}/${link.id}`;
            
            linkCard.innerHTML = `
                <h3>${link.subject}</h3>
                <span class="mode-indicator ${link.mode || 'investigator'}">
                    ${(link.mode || 'investigator').charAt(0).toUpperCase() + (link.mode || 'investigator').slice(1)}
                </span>
                <div class="link-container" style="display: flex; align-items: center; gap: 10px;">
                    <span class="link-url" style="font-family: monospace; overflow: hidden; text-overflow: ellipsis;">${fullUrl}</span>
                    <button class="copy-link-btn" style="
                        padding: 5px 10px;
                        background: #4F46E5;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                        white-space: nowrap;
                    "> Copy</button>
                </div>
                <button class="delete-link-btn" data-id="${link.id}">Delete</button>
            `;
            
            // Insert at the beginning of the list
            if (linksList.firstChild) {
                linksList.insertBefore(linkCard, linksList.firstChild);
            } else {
                linksList.appendChild(linkCard);
            }

            // Add copy event listener
            const copyBtn = linkCard.querySelector('.copy-link-btn');
            const urlSpan = linkCard.querySelector('.link-url');
            
            copyBtn.addEventListener('click', async () => {
                const success = await copyToClipboard(urlSpan.textContent);
                if (success) {
                    const originalText = copyBtn.innerHTML;
                    const originalBg = copyBtn.style.background;
                    copyBtn.innerHTML = '✅ Copied!';
                    copyBtn.style.background = '#059669';
                    setTimeout(() => {
                        copyBtn.innerHTML = originalText;
                        copyBtn.style.background = originalBg;
                    }, 2000);
                }
            });
        });
        
        // Add delete handlers
        document.querySelectorAll('.delete-link-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteLink(btn.dataset.id));
        });
    } catch (error) {
        console.error('Error loading links:', error);
        showMessage('Failed to load links', true);
    }
}; 

// Add the copyToClipboard helper function
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                textArea.remove();
                return true;
            } catch (error) {
                textArea.remove();
                return false;
            }
        }
    } catch (error) {
        return false;
    }
}

// Update the createLinkElement function
function createLinkElement(link, mode) {
    const container = document.createElement('div');
    container.className = 'link-container';
    container.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 5px 0;
    `;

    const linkText = document.createElement('span');
    linkText.textContent = `${window.location.origin}/${mode}/${link}`;
    linkText.style.cssText = `
        font-family: monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    `;

    const copyButton = document.createElement('button');
    copyButton.innerHTML = ' Copy';
    copyButton.className = 'copy-button';
    copyButton.style.cssText = `
        padding: 5px 10px;
        background: #4F46E5;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        min-width: 70px;
    `;

    copyButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const success = await copyToClipboard(linkText.textContent);
        if (success) {
            const originalText = copyButton.innerHTML;
            copyButton.innerHTML = '✅ Copied!';
            copyButton.style.background = '#059669';
            setTimeout(() => {
                copyButton.innerHTML = originalText;
                copyButton.style.background = '#4F46E5';
            }, 2000);
        }
    });

    container.appendChild(linkText);
    container.appendChild(copyButton);
    return container;
}

// Update the displayLinks function to use the new link elements
function displayLinks(links) {
    const linksContainer = document.getElementById('linksContainer');
    linksContainer.innerHTML = '';
    
    if (links.length === 0) {
        linksContainer.innerHTML = '<p>No links generated yet.</p>';
        return;
    }

    links.forEach(link => {
        const linkElement = createLinkElement(link.id, link.mode);
        linksContainer.appendChild(linkElement);
    });
}

// Add this to your CSS (you can add it inline or in your stylesheet)
const style = document.createElement('style');
style.textContent = `
    .info-icon:hover .tooltip {
        visibility: visible;
        opacity: 1;
    }

    @media (max-width: 768px) {
        .tooltip {
            width: 150px;
            font-size: 12px;
            padding: 6px 10px;
        }
    }
`;
document.head.appendChild(style);

// Function to add a link card to the list
function addLinkCard(link) {
    const linkCard = document.createElement('div');
    linkCard.className = `link-card ${link.mode.toLowerCase()}`;
    linkCard.innerHTML = `
        <h3>
            ${link.subject}
            <span class="mode-indicator ${link.mode.toLowerCase()}">${link.mode}</span>
        </h3>
        <div class="link-url">${window.location.origin}/${link.mode.toLowerCase()}/${link.id}</div>
        <div class="button-group">
            <button class="copy-link-btn" onclick="copyLink('${link.id}')">Copy Link</button>
            <button class="delete-link-btn" onclick="deleteLink('${link.id}')">Delete Link</button>
        </div>
    `;
    
    // Insert at the beginning of the list
    const linksList = document.getElementById('linksList');
    if (linksList.firstChild) {
        linksList.insertBefore(linkCard, linksList.firstChild);
    } else {
        linksList.appendChild(linkCard);
    }
}

// Load user's links
async function loadLinks() {
    try {
        const token = localStorage.getItem('teacherToken');
        const response = await fetch('/api/links', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load links');
        }

        const links = await response.json();
        
        // Sort links by creation date (newest first)
        links.sort((a, b) => {
            const dateA = new Date(a.created_at || a.created);
            const dateB = new Date(b.created_at || b.created);
            return dateB - dateA;
        });

        // Clear existing links
        const linksList = document.getElementById('linksList');
        linksList.innerHTML = '';

        // Add links in sorted order (newest first)
        links.forEach(link => {
            const linkCard = document.createElement('div');
            linkCard.className = `link-card ${link.mode.toLowerCase()}`;
            linkCard.innerHTML = `
                <h3>
                    ${link.subject}
                    <span class="mode-indicator ${link.mode.toLowerCase()}">${link.mode}</span>
                </h3>
                <div class="link-url">${window.location.origin}/${link.mode.toLowerCase()}/${link.id}</div>
                <div class="button-group">
                    <button class="copy-link-btn" onclick="copyLink('${link.id}')">Copy Link</button>
                    <button class="delete-link-btn" onclick="deleteLink('${link.id}')">Delete Link</button>
                </div>
            `;
            // Append each link to maintain the sorted order
            linksList.appendChild(linkCard);
        });
    } catch (error) {
        console.error('Error loading links:', error);
        showMessage('Failed to load links', true);
    }
}