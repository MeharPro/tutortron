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
        const { name, email, password, school, accessCode } = await request.json();

        // Validate access code
        if (accessCode !== 'TEACH2024') {
            return new Response(JSON.stringify({ error: 'Invalid access code' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if user already exists
        const existingUser = await env.TEACHERS.get(email);
        if (existingUser) {
            return new Response(JSON.stringify({ error: 'Email already registered' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Create new user
        const token = crypto.randomUUID();
        const user = {
            name,
            email,
            password, // Note: In production, you should hash the password
            school,
            token,
            links: []
        };

        // Store user data
        await env.TEACHERS.put(email, JSON.stringify(user));
        await env.TEACHERS.put(token, JSON.stringify(user));

        return new Response(JSON.stringify({ token }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Registration error:', error);
        return new Response(JSON.stringify({ error: 'Registration failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
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

// API keys endpoint
router.get('/api/keys', async (request, env) => {
    try {
        // First try D1
        const { results } = await env.DB.prepare(`
            SELECT key_value FROM api_keys WHERE key_name = 'OPENROUTER_API_KEY'
        `).all();

        if (results && results.length > 0) {
            return new Response(JSON.stringify({
                OPENROUTER_API_KEY: results[0].key_value
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Fallback to environment variable
        if (env.OPENROUTER_API_KEY) {
            return new Response(JSON.stringify({
                OPENROUTER_API_KEY: env.OPENROUTER_API_KEY
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'API key not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error fetching API keys:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch API keys' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Get links endpoint
router.get('/api/links', async (request, env) => {
    try {
        const token = request.headers.get('Authorization')?.split(' ')[1];
        if (!token) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get user from token
        const user = await env.TEACHERS.get(token, { type: 'json' });
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get links from D1, ordered by creation date
        const { results } = await env.DB.prepare(`
            SELECT * FROM links 
            WHERE user_email = ? 
            ORDER BY created_at DESC
        `).bind(user.email).all();

        return new Response(JSON.stringify(results || []), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error getting links:', error);
        return new Response(JSON.stringify({ error: 'Failed to get links' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Create a new link
router.post('/api/links', async (request, env) => {
    try {
        const token = request.headers.get('Authorization')?.split(' ')[1];
        if (!token) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get user from token
        const user = await env.TEACHERS.get(token, { type: 'json' });
        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get link data from request
        const { subject, prompt, mode } = await request.json();
        
        if (!subject || !prompt || !mode) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Create new link
        const id = crypto.randomUUID();
        const link = {
            id,
            subject,
            prompt,
            mode,
            created_at: new Date().toISOString(),
            user_email: user.email
        };

        // Store in D1
        await env.DB.prepare(`
            INSERT INTO links (id, subject, prompt, mode, created_at, user_email)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            link.id,
            link.subject,
            link.prompt,
            link.mode,
            link.created_at,
            link.user_email
        ).run();

        // Update user's links in KV
        if (!user.links) user.links = [];
        user.links.push(link);
        await env.TEACHERS.put(token, JSON.stringify(user));

        return new Response(JSON.stringify(link), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error creating link:', error);
        return new Response(JSON.stringify({ error: 'Failed to create link' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Get a specific link
router.get('/api/links/:id', async (request, env) => {
    try {
        const url = new URL(request.url);
        const id = url.pathname.split('/').pop();
        
        // First try to get from D1
        const { results } = await env.DB.prepare(`
            SELECT * FROM links WHERE id = ?
        `).bind(id).all();

        if (results && results.length > 0) {
            const link = results[0];
            return new Response(JSON.stringify(link), {
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        // If not in D1, try KV
        let link = await env.TEACHERS.get(`link:${id}`, { type: 'json' });

        if (!link) {
            // If not found in KV directly, try user's links
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

// Delete a link
router.delete('/api/links/:id', async (request, env) => {
    try {
        const token = request.headers.get('Authorization')?.split(' ')[1];
        if (!token) {
            return new Response('Unauthorized', { status: 401 });
        }

        // Verify token and get user email
        const user = await env.TEACHERS.get(token, { type: 'json' });
        if (!user) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { id } = request.params;

        // Delete from D1
        await env.DB.prepare('DELETE FROM links WHERE id = ? AND user_email = ?')
            .bind(id, user.email)
            .run();

        // Also remove from user's links in KV
        const updatedUser = { ...user };
        if (updatedUser.links) {
            updatedUser.links = updatedUser.links.filter(link => link.id !== id);
            await env.TEACHERS.put(token, JSON.stringify(updatedUser));
        }

        // Delete from separate KV storage if exists
        await env.TEACHERS.delete(`link:${id}`);

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error deleting link:', error);
        return new Response(JSON.stringify({ error: 'Failed to delete link' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});

// Function to decode base64 content
function decodeBase64(base64) {
    try {
        return atob(base64);
    } catch (error) {
        console.error('Error decoding base64:', error);
        throw error;
    }
}

// Serve static files
router.get('*', async (request, env) => {
    try {
        const url = new URL(request.url);
        let path = url.pathname;

        // Default to index.html for root path
        if (path === '/') {
            path = '/index.html';
        }

        // Remove leading slash and 'public' from path if present
        const normalizedPath = path.replace(/^\//, '').replace(/^public\//, '');

        // Handle mode-specific routes
        const modeMatch = normalizedPath.match(/^(investigator|comparitor|codebreaker|quest|eliminator)\/([^\/]+)$/);
        if (modeMatch) {
            const [, mode, id] = modeMatch;
            
            // Get link from D1
            const { results: linkResults } = await env.DB.prepare(`
                SELECT * FROM links WHERE id = ?
            `).bind(id).all();

            let link = linkResults?.[0];
            if (!link) {
                // If not in D1, try KV
                link = await env.TEACHERS.get(`link:${id}`, { type: 'json' });
            }

            if (!link || link.mode.toLowerCase() !== mode.toLowerCase()) {
                return Response.redirect(`${url.origin}/invalid-link.html`, 302);
            }

            // Get tutor.html from D1
            const { results: fileResults } = await env.DB.prepare(`
                SELECT content, content_type FROM files WHERE path = ?
            `).bind('tutor.html').all();

            if (!fileResults?.length) {
                return new Response('Tutor page not found', { status: 404 });
            }

            // Replace placeholders in tutor.html
            let content = decodeBase64(fileResults[0].content);
            
            // Properly escape values for JavaScript
            const escapedConfig = {
                subject: link.subject.replace(/["\\]/g, '\\$&'),
                prompt: link.prompt.replace(/["\\]/g, '\\$&'),
                mode: link.mode.replace(/["\\]/g, '\\$&')
            };

            content = content.replace(
                'window.TUTOR_CONFIG = {',
                `window.TUTOR_CONFIG = {
                    subject: "${escapedConfig.subject}",
                    prompt: "${escapedConfig.prompt}",
                    mode: "${escapedConfig.mode}"`
            );

            return new Response(content, {
                headers: { 'Content-Type': fileResults[0].content_type }
            });
        }

        // Get file from D1
        const { results } = await env.DB.prepare(`
            SELECT content, content_type FROM files WHERE path = ?
        `).bind(normalizedPath).all();

        if (!results?.length) {
            console.error(`File not found: ${normalizedPath}`);
            return new Response('Not found', { status: 404 });
        }

        const { content, content_type } = results[0];
        const decodedContent = decodeBase64(content);

        return new Response(decodedContent, {
            headers: { 'Content-Type': content_type }
        });
    } catch (error) {
        console.error('Error serving file:', error, error.stack);
        return new Response(`Internal Server Error: ${error.message}`, { 
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
});

export default {
    fetch: (request, env) => router.handle(request, env)
};