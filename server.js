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

// Get all links for a teacher
router.get('/api/links', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) {
            console.error('No authenticated user found');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        console.log('Getting links for user:', user.email);

        // Get links from D1
        const d1Result = await env.DB.prepare(`
            SELECT * FROM links WHERE user_email = ? ORDER BY created_at DESC
        `).bind(user.email).all();
        
        console.log('D1 query result:', d1Result);
        const d1Links = d1Result.results || [];
        console.log('D1 links:', d1Links);

        // Get links from KV
        const kvLinks = user.links || [];
        console.log('KV links:', kvLinks);

        // Combine and deduplicate links
        const allLinks = [...d1Links];
        for (const kvLink of kvLinks) {
            if (!allLinks.some(link => link.id === kvLink.id)) {
                // Store KV link in D1 for future access
                try {
                    await env.DB.prepare(`
                        INSERT INTO links (id, mode, subject, prompt, created_at, user_email)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(
                        kvLink.id,
                        kvLink.mode,
                        kvLink.subject,
                        kvLink.prompt,
                        kvLink.created || kvLink.created_at,
                        user.email
                    ).run();
                } catch (error) {
                    console.error('Error migrating KV link to D1:', error);
                }
                allLinks.push(kvLink);
            }
        }
        console.log('Combined links:', allLinks);

        // Sort by created date
        allLinks.sort((a, b) => {
            const dateA = new Date(a.created_at || a.created);
            const dateB = new Date(b.created_at || b.created);
            return dateB - dateA;
        });

        return new Response(JSON.stringify(allLinks), {
            headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
            }
        });
    } catch (error) {
        console.error('Error fetching links:', error);
        console.error('Error stack:', error.stack);
        return new Response(JSON.stringify({ 
            error: 'Failed to fetch links',
            message: error.message,
            stack: error.stack,
            cause: error.cause
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
        const created = new Date().toISOString();
        
        // Store in D1
        await env.DB.prepare(`
            INSERT INTO links (id, mode, subject, prompt, created_at, user_email)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            mode,
            subject,
            prompt,
            created,
            user.email
        ).run();

        const link = {
            id,
            mode,
            subject,
            prompt,
            created,
            user_email: user.email
        };

        // Also store in KV for backward compatibility
        if (!user.links) {
            user.links = [];
        }
        user.links.unshift(link);
        await env.TEACHERS.put(user.email, JSON.stringify(user));
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
            
            // First try to get from D1
            const { results } = await env.DB.prepare(`
                SELECT * FROM links WHERE id = ?
            `).bind(id).all();

            let link;
            if (results && results.length > 0) {
                link = results[0];
            } else {
                // If not in D1, try KV
                link = await env.TEACHERS.get(`link:${id}`, { type: 'json' });
                
                if (!link) {
                    // If not found in KV directly, try user's links
                    const users = await env.TEACHERS.list({ prefix: '' });
                    for (const key of users.keys) {
                        if (key.name === 'api_keys') continue;
                        const user = await env.TEACHERS.get(key.name, { type: 'json' });
                        if (user && user.links) {
                            const foundLink = user.links.find(l => l.id === id);
                            if (foundLink) {
                                link = foundLink;
                                // Store in D1 for future access
                                try {
                                    await env.DB.prepare(`
                                        INSERT INTO links (id, mode, subject, prompt, created_at, user_email)
                                        VALUES (?, ?, ?, ?, ?, ?)
                                    `).bind(
                                        foundLink.id,
                                        foundLink.mode,
                                        foundLink.subject,
                                        foundLink.prompt,
                                        foundLink.created || foundLink.created_at,
                                        user.email
                                    ).run();
                                } catch (error) {
                                    console.error('Error migrating link to D1:', error);
                                }
                                break;
                            }
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

            // Replace placeholders in tutor.html with properly escaped values
            let content = decodeBase64(fileResults[0].content);
            const escapedSubject = JSON.stringify(link.subject).slice(1, -1);
            const escapedPrompt = JSON.stringify(link.prompt).slice(1, -1);
            const escapedMode = JSON.stringify(link.mode).slice(1, -1);
            
            content = content.replace('{{SUBJECT}}', escapedSubject)
                           .replace('{{PROMPT}}', escapedPrompt)
                           .replace('{{MODE}}', escapedMode);

            return new Response(content, {
                headers: { 'Content-Type': fileResults[0].content_type }
            });
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