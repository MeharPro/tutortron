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
        const { results } = await env.DB.prepare(`
            SELECT * FROM teachers WHERE id = ?
        `).bind(token).all();
        
        return results[0] || null;
    } catch (error) {
        console.error('Auth error:', error);
        return null;
    }
}

// API Routes
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

        const { results } = await env.DB.prepare(`
            SELECT * FROM links WHERE teacher_id = ?
            ORDER BY created_at DESC
        `).bind(user.id).all();

        return new Response(JSON.stringify(results || []), {
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
        
        const result = await env.DB.prepare(`
            INSERT INTO links (id, teacher_id, mode, subject, prompt)
            VALUES (?, ?, ?, ?, ?)
        `).bind(id, user.id, mode, subject, prompt).run();

        if (!result.success) {
            throw new Error('Failed to create link');
        }

        const { results } = await env.DB.prepare(`
            SELECT * FROM links WHERE id = ?
        `).bind(id).all();

        return new Response(JSON.stringify({ 
            success: true,
            link: results[0]
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
        
        const { results } = await env.DB.prepare(`
            SELECT * FROM links WHERE id = ?
        `).bind(id).all();

        if (!results || results.length === 0) {
            return new Response(JSON.stringify({ error: 'Link not found' }), {
                status: 404,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        return new Response(JSON.stringify(results[0]), {
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

        // Handle mode-specific routes
        const modeMatch = path.match(/^\/(investigator|comparitor|codebreaker|quest|eliminator)\/([^\/]+)$/);
        if (modeMatch) {
            const [, mode, id] = modeMatch;
            
            // Check if link exists
            const { results: linkResults } = await env.DB.prepare(`
                SELECT id FROM links WHERE id = ?
            `).bind(id).all();

            if (!linkResults || linkResults.length === 0) {
                return new Response('Link not found', { status: 404 });
            }

            // Get tutor.html from D1
            const { results: fileResults } = await env.DB.prepare(`
                SELECT content, content_type FROM files WHERE path = ?
            `).bind('public/tutor.html').all();

            if (!fileResults || fileResults.length === 0) {
                return new Response('File not found', { status: 404 });
            }

            const content = decodeBase64(fileResults[0].content);
            return new Response(content, {
                headers: { 'Content-Type': fileResults[0].content_type }
            });
        }

        // Serve static files from D1
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