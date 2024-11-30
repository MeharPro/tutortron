import { Router } from 'itty-router';

const router = Router();

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

// Add CORS preflight handler
router.options('*', () => new Response(null, { headers: corsHeaders }));

// Authentication middleware
async function authenticate(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];
    try {
        // Get user from KV
        const user = await env.TEACHERS.get(token, { type: 'json' });
        return user;
    } catch (error) {
        console.error('Auth error:', error);
        return null;
    }
}

// API Routes
router.post('/api/auth/login', async (request, env) => {
    try {
        const { email, password } = await request.json();
        
        // Get user from KV
        const user = await env.TEACHERS.get(email, { type: 'json' });
        
        if (!user || user.password !== password) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
                status: 401,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        return new Response(JSON.stringify({ 
            token: email,
            user: {
                name: user.name,
                email: user.email,
                school: user.school
            }
        }), {
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return new Response(JSON.stringify({ error: 'Login failed' }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
});

router.post('/api/auth/register', async (request, env) => {
    try {
        const { name, email, password, school } = await request.json();
        
        // Check if user exists
        const existingUser = await env.TEACHERS.get(email);
        if (existingUser) {
            return new Response(JSON.stringify({ error: 'Email already registered' }), {
                status: 409,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        // Store user in KV
        await env.TEACHERS.put(email, JSON.stringify({
            name,
            email,
            password,
            school
        }));

        return new Response(JSON.stringify({ success: true }), {
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        return new Response(JSON.stringify({ error: 'Registration failed' }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
});

router.get('/api/auth/verify', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }

    return new Response(JSON.stringify({ 
        user: {
            name: user.name,
            email: user.email,
            school: user.school
        }
    }), {
        headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
});

router.get('/api/keys', async (request, env) => {
    try {
        // Get API keys from KV
        const keys = await env.TEACHERS.get('api_keys', { type: 'json' });
        
        if (!keys) {
            return new Response(JSON.stringify({ error: 'No API keys found' }), {
                status: 404,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        return new Response(JSON.stringify(keys), {
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        console.error('Error fetching API keys:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to fetch API keys',
            message: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
});

// Get all links for a teacher
router.get('/api/links', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        // Get links from user object
        const links = user.links || [];

        return new Response(JSON.stringify(links), {
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        console.error('Error fetching links:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to fetch links',
            message: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
});

// Create a new link
router.post('/api/links', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        const { mode, subject, prompt } = await request.json();
        
        if (!mode || !subject || !prompt) {
            return new Response(JSON.stringify({ 
                error: 'Missing required fields' 
            }), {
                status: 400,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        const id = crypto.randomUUID();
        const link = {
            id,
            mode,
            subject,
            prompt,
            created: new Date().toISOString()
        };

        // Add link to user's links array
        if (!user.links) {
            user.links = [];
        }
        user.links.unshift(link);

        // Update user in KV
        await env.TEACHERS.put(user.email, JSON.stringify(user));

        // Store individual link for quick access
        await env.TEACHERS.put(`link:${id}`, JSON.stringify(link));

        return new Response(JSON.stringify({ 
            success: true,
            link
        }), {
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        console.error('Error creating link:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to create link',
            message: error.message
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
});

// Get a specific link
router.get('/api/links/:id', async (request, env) => {
    try {
        const url = new URL(request.url);
        const id = url.pathname.split('/').pop();
        
        // First try to get link from KV
        let link = await env.TEACHERS.get(`link:${id}`, { type: 'json' });

        if (!link) {
            // If not found, try to find in user's links
            const users = await env.TEACHERS.list({ prefix: '' });
            for (const key of users.keys) {
                if (key.name === 'api_keys') continue;
                const user = await env.TEACHERS.get(key.name, { type: 'json' });
                if (user && user.links) {
                    link = user.links.find(l => l.id === id);
                    if (link) {
                        // Store link separately for future quick access
                        await env.TEACHERS.put(`link:${id}`, JSON.stringify(link));
                        break;
                    }
                }
            }
        }

        if (!link) {
            return new Response(JSON.stringify({ error: 'Link not found' }), {
                status: 404,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        return new Response(JSON.stringify(link), {
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        console.error('Error fetching link:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to fetch link',
            message: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
});

// Delete a link
router.delete('/api/links/:id', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        const url = new URL(request.url);
        const id = url.pathname.split('/').pop();

        // Remove link from user's links array
        if (user.links) {
            const linkIndex = user.links.findIndex(l => l.id === id);
            if (linkIndex !== -1) {
                user.links.splice(linkIndex, 1);
                // Update user in KV
                await env.TEACHERS.put(user.email, JSON.stringify(user));
            }
        }

        // Remove individual link from KV
        await env.TEACHERS.delete(`link:${id}`);

        return new Response(JSON.stringify({ success: true }), {
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        console.error('Error deleting link:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to delete link',
            message: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    }
});

// Function to decode base64 content
function decodeBase64(base64) {
    try {
        const binaryString = atob(base64);
        return new TextDecoder().decode(new Uint8Array([...binaryString].map(c => c.charCodeAt(0))));
    } catch (error) {
        console.error('Error decoding base64:', error);
        throw error;
    }
}

// Serve static files
router.get('*', async (request, env) => {
    try {
        const url = new URL(request.url);
        const path = url.pathname;

        // Special case for invalid-link.html
        if (path === '/invalid-link.html') {
            const { results } = await env.DB.prepare(`
                SELECT content, content_type FROM files WHERE path = ?
            `).bind('public/invalid-link.html').all();

            if (!results || results.length === 0) {
                return new Response('Invalid link', { 
                    status: 404,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            const content = decodeBase64(results[0].content);
            return new Response(content, {
                headers: { 'Content-Type': results[0].content_type }
            });
        }

        // Handle mode-specific routes
        const modeMatch = path.match(/^\/(investigator|comparitor|codebreaker|quest|eliminator)\/([^\/]+)$/);
        if (modeMatch) {
            const [, mode, id] = modeMatch;
            
            // First try to get link from KV
            let link = await env.TEACHERS.get(`link:${id}`, { type: 'json' });

            if (!link) {
                // If not found, try to find in user's links
                const users = await env.TEACHERS.list({ prefix: '' });
                for (const key of users.keys) {
                    if (key.name === 'api_keys') continue;
                    const user = await env.TEACHERS.get(key.name, { type: 'json' });
                    if (user && user.links) {
                        link = user.links.find(l => l.id === id);
                        if (link) {
                            // Store link separately for future quick access
                            await env.TEACHERS.put(`link:${id}`, JSON.stringify(link));
                            break;
                        }
                    }
                }
            }

            if (!link) {
                // Redirect to invalid-link.html
                return Response.redirect(`${url.origin}/invalid-link.html`, 302);
            }

            // Verify mode matches
            if (link.mode.toLowerCase() !== mode.toLowerCase()) {
                console.error(`Mode mismatch: URL has ${mode}, link has ${link.mode}`);
                return Response.redirect(`${url.origin}/invalid-link.html`, 302);
            }

            // Get tutor.html from D1
            const { results: fileResults } = await env.DB.prepare(`
                SELECT content, content_type FROM files WHERE path = ?
            `).bind('public/tutor.html').all();

            if (!fileResults || fileResults.length === 0) {
                return new Response('File not found', { status: 404 });
            }

            // Get API keys for initial response
            const apiKeys = await env.TEACHERS.get('api_keys', { type: 'json' });
            if (!apiKeys) {
                return new Response('API keys not found', { status: 500 });
            }

            // Get initial AI response
            try {
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKeys.OPENROUTER_API_KEY}`,
                        'HTTP-Referer': 'https://tutortron.dizon-dzn12.workers.dev/',
                        'X-Title': 'Tutor-Tron'
                    },
                    body: JSON.stringify({
                        model: mode === 'codebreaker' ? 'google/gemini-pro' : 'anthropic/claude-3-opus',
                        messages: [
                            {
                                role: "system",
                                content: `You are a tutor helping a student with ${link.subject}. ${link.prompt}`
                            }
                        ]
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to get AI response');
                }

                const data = await response.json();
                const aiMessage = data.choices[0].message.content;

                // Replace placeholders in tutor.html
                let content = decodeBase64(fileResults[0].content);
                content = content.replace('{{SUBJECT}}', link.subject)
                               .replace('{{PROMPT}}', link.prompt)
                               .replace('{{MODE}}', link.mode)
                               .replace('{{INITIAL_RESPONSE}}', aiMessage);

                return new Response(content, {
                    headers: { 'Content-Type': fileResults[0].content_type }
                });
            } catch (error) {
                console.error('Error getting initial AI response:', error);
                // Still serve the page but without initial response
                let content = decodeBase64(fileResults[0].content);
                content = content.replace('{{SUBJECT}}', link.subject)
                               .replace('{{PROMPT}}', link.prompt)
                               .replace('{{MODE}}', link.mode)
                               .replace('{{INITIAL_RESPONSE}}', '');

                return new Response(content, {
                    headers: { 'Content-Type': fileResults[0].content_type }
                });
            }
        }

        // Serve other static files from D1
        const filePath = path === '/' ? '/index.html' : path;
        const { results } = await env.DB.prepare(`
            SELECT content, content_type FROM files WHERE path = ?
        `).bind(`public${filePath}`).all();

        if (!results || results.length === 0) {
            console.error(`File not found: public${filePath}`);
            return new Response('Not found', { status: 404 });
        }

        const content = decodeBase64(results[0].content);
        return new Response(content, {
            headers: { 'Content-Type': results[0].content_type }
        });
    } catch (error) {
        console.error('Error serving file:', error);
        return new Response(`Internal Server Error: ${error.message}`, { 
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
});

export default {
    fetch: (request, env) => router.handle(request, env)
};