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
router.post('/api/auth/login', async (request, env) => {
    try {
        const { email, password } = await request.json();
        
        const { results } = await env.DB.prepare(`
            SELECT * FROM teachers 
            WHERE email = ? AND password = ?
        `).bind(email, password).all();

        if (!results || results.length === 0) {
            return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
                status: 401,
                headers: { 
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }

        return new Response(JSON.stringify({ 
            token: results[0].id,
            user: {
                name: results[0].name,
                email: results[0].email,
                school: results[0].school
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
        
        const result = await env.DB.prepare(`
            INSERT INTO teachers (name, email, password, school)
            VALUES (?, ?, ?, ?)
        `).bind(name, email, password, school).run();

        if (!result.success) {
            throw new Error('Failed to register');
        }

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
            INSERT INTO links (id, teacher_id, subject, prompt)
            VALUES (?, ?, ?, ?)
        `).bind(id, user.id, subject, prompt).run();

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

// Serve static files
router.get('*', async (request, env) => {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle mode-specific routes
    const modeMatch = path.match(/^\/(investigator|comparitor|codebreaker|quest|eliminator)\/([^\/]+)$/);
    if (modeMatch) {
        const [, mode, id] = modeMatch;
        
        // Check if link exists
        const { results } = await env.DB.prepare(`
            SELECT id FROM links WHERE id = ?
        `).bind(id).all();

        if (!results || results.length === 0) {
            return new Response('Link not found', { status: 404 });
        }

        // Serve tutor.html
        const tutorHtml = await env.FILES.get('public/tutor.html');
        return new Response(tutorHtml, {
            headers: { 'Content-Type': 'text/html' }
        });
    }

    // Serve static files from public directory
    const filePath = path === '/' ? '/index.html' : path;
    const file = await env.FILES.get(`public${filePath}`);
    
    if (!file) {
        return new Response('Not found', { status: 404 });
    }

    const contentType = getContentType(filePath);
    return new Response(file, {
        headers: { 'Content-Type': contentType }
    });
});

function getContentType(path) {
    const ext = path.split('.').pop().toLowerCase();
    const types = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml'
    };
    return types[ext] || 'text/plain';
}

export default {
    fetch: (request, env) => router.handle(request, env)
};