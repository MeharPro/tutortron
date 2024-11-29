import { Router } from 'itty-router';

const router = Router();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper function for error handling
function handleError(type, headers = {}) {
  switch (type) {
    case 'not-found':
      return Response.redirect('/invalid-link.html', 302);
    case 'unauthorized':
      return Response.redirect('/unauthorized.html', 302);
    case 'server-error':
      return Response.redirect('/error.html', 302);
    default:
      return Response.redirect('/invalid-link.html', 302);
  }
}

// Function to serve static files with improved error handling
async function serveStaticFile(url, env) {
  try {
    const path = url.pathname.replace(/^\//, '') || 'index.html';
    
    // Special handling for error pages to prevent redirect loops
    if (['invalid-link.html', 'unauthorized.html', 'error.html'].includes(path)) {
      const errorPage = await env.FILES.get(path);
      if (errorPage === null) {
        return new Response('Error page not found', { 
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
      return new Response(errorPage, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const file = await env.FILES.get(path);
    if (file === null) {
      if (path.endsWith('/')) {
        const indexFile = await env.FILES.get(path + 'index.html');
        if (indexFile === null) {
          return handleError('not-found');
        }
        return new Response(indexFile, {
          headers: { 'Content-Type': 'text/html' },
        });
      }
      return handleError('not-found');
    }
    
    const contentType = getContentType(path);
    return new Response(file, {
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return handleError('server-error');
  }
}

// Helper function to determine content type
function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif'
  };
  return types[ext] || 'text/plain';
}

// Simple JWT functions
const createToken = async (payload, secret) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const content = btoa(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${header}.${content}`)
  );
  
  return `${header}.${content}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
};

router.options('*', () => new Response(null, { headers: corsHeaders }));

// Register route with error handling
router.post('/api/auth/register', async (request, env) => {
  try {
    const { name, email, password, school, accessCode } = await request.json();

    if (!name || !email || !password || !school || !accessCode) {
      return new Response(JSON.stringify({ message: 'All fields are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (accessCode !== 'TEACH2024') {
      return new Response(JSON.stringify({ message: 'Invalid access code' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingTeacher = await env.TEACHERS.get(email);
    if (existingTeacher) {
      return new Response(JSON.stringify({ message: 'Email already registered' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openrouterKey = env.OPENROUTER_MASTER_KEY;
    const teacherId = crypto.randomUUID();
    
    await env.TEACHERS.put(email, JSON.stringify({
      id: teacherId,
      name,
      email,
      password,
      school,
      openrouterKey,
      links: [],
      createdAt: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: 'Registration successful' }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return handleError('server-error');
  }
});

// Login route with error handling
router.post('/api/auth/login', async (request, env) => {
  try {
    const { email, password } = await request.json();

    const teacherData = await env.TEACHERS.get(email);
    if (!teacherData) {
      return handleError('unauthorized');
    }

    const teacher = JSON.parse(teacherData);
    if (teacher.password !== password) {
      return handleError('unauthorized');
    }

    const token = await createToken({ teacherId: teacher.id }, env.JWT_SECRET);
    return new Response(JSON.stringify({ 
      token,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Login error:', error);
    return handleError('server-error');
  }
});

// Verify token route with error handling
router.get('/api/auth/verify', async (request, env) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handleError('unauthorized');
    }

    const token = authHeader.split(' ')[1];
    return new Response(JSON.stringify({ valid: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return handleError('server-error');
  }
});

// Create link route with error handling
router.post('/api/links', async (request, env) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handleError('unauthorized');
    }

    const { subject, prompt, mode } = await request.json();
    const token = authHeader.split(' ')[1];
    
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    const teacherId = decodedPayload.teacherId;

    let foundTeacher = null;
    let teacherKey = null;
    const teachersList = await env.TEACHERS.list();
    
    for (const key of teachersList.keys) {
      const teacherData = await env.TEACHERS.get(key.name);
      const teacher = JSON.parse(teacherData);
      if (teacher.id === teacherId) {
        foundTeacher = teacher;
        teacherKey = key.name;
        break;
      }
    }

    if (!foundTeacher) {
      return handleError('not-found');
    }

    const linkId = crypto.randomUUID();
    foundTeacher.links.push({
      id: linkId,
      subject,
      prompt,
      mode,
      created: new Date().toISOString()
    });

    await env.TEACHERS.put(teacherKey, JSON.stringify(foundTeacher));

    return new Response(JSON.stringify({ message: 'Link created', linkId }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Link creation error:', error);
    return handleError('server-error');
  }
});

// Get links route with error handling
router.get('/api/links', async (request, env) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handleError('unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    const teacherId = decodedPayload.teacherId;

    let foundTeacher = null;
    const teachersList = await env.TEACHERS.list();
    
    for (const key of teachersList.keys) {
      const teacherData = await env.TEACHERS.get(key.name);
      const teacher = JSON.parse(teacherData);
      if (teacher.id === teacherId) {
        foundTeacher = teacher;
        break;
      }
    }

    if (!foundTeacher) {
      return handleError('not-found');
    }

    return new Response(JSON.stringify(foundTeacher.links || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get links error:', error);
    return handleError('server-error');
  }
});

// Delete link route with error handling
router.delete('/api/links/:linkId', async (request, env) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handleError('unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    const teacherId = decodedPayload.teacherId;

    let foundTeacher = null;
    let teacherKey = null;
    const teachersList = await env.TEACHERS.list();
    
    for (const key of teachersList.keys) {
      const teacherData = await env.TEACHERS.get(key.name);
      const teacher = JSON.parse(teacherData);
      if (teacher.id === teacherId) {
        foundTeacher = teacher;
        teacherKey = key.name;
        break;
      }
    }

    if (!foundTeacher) {
      return handleError('not-found');
    }

    const { linkId } = request.params;
    foundTeacher.links = foundTeacher.links.filter(link => link.id !== linkId);
    await env.TEACHERS.put(teacherKey, JSON.stringify(foundTeacher));

    return new Response(JSON.stringify({ message: 'Link deleted' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete link error:', error);
    return handleError('server-error');
  }
});

// Environment variables route with error handling
router.get('/api/env', async (request, env) => {
  try {
    return new Response(JSON.stringify({
      OPENROUTER_API_KEY: env.OPENROUTER_API_KEY || '',
      DEEPGRAM_API_KEY: env.DEEPGRAM_API_KEY || ''
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Environment variables error:', error);
    return handleError('server-error');
  }
});

// API keys route with error handling
router.get('/api/keys', async (request, env) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handleError('unauthorized');
    }

    const apiKeys = env.OPENROUTER_API_KEYS.split(',');
    const randomKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

    return new Response(JSON.stringify({
      OPENROUTER_API_KEY: randomKey,
      DEEPGRAM_API_KEY: env.DEEPGRAM_API_KEY
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API keys error:', error);
    return handleError('server-error');
  }
});

// Tutor route with error handling
router.get('/:mode/:linkId', async (request, env) => {
  try {
    const { mode, linkId } = request.params;
    console.log('Looking for link:', linkId, 'Mode:', mode);

    const validModes = ['investigator', 'comparitor', 'quest', 'codebreaker', 'eliminator'];
    if (!validModes.includes(mode)) {
      return handleError('not-found');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(linkId)) {
      console.log('Invalid link format:', linkId);
      return handleError('not-found');
    }
    
    let foundLink = null;
    const teachersList = await env.TEACHERS.list();
    
    for (const key of teachersList.keys) {
      const teacherData = await env.TEACHERS.get(key.name);
      const teacher = JSON.parse(teacherData);
      
      if (teacher.links) {
        const link = teacher.links.find(l => l.id === linkId && l.mode === mode);
        if (link) {
          foundLink = link;
          break;
        }
      }
    }

    if (!foundLink) {
      console.log('Link not found:', linkId);
      return handleError('not-found');
    }

    let tutorHtml = await env.FILES.get('tutor.html');
    if (!tutorHtml) {
      return handleError('not-found');
    }

    const bgColors = {
      investigator: '#f0fdf4',
      comparitor: '#eff6ff',
      quest: '#fff1f2',
      codebreaker: '#000000',
      eliminator: '#1a0000'
    };


        // Update the title and background color
        tutorHtml = tutorHtml.replace(
            '<title>Tutor-Tron AI Investigator</title>',
            `<title>${mode.charAt(0).toUpperCase() + mode.slice(1)} - Tutor-Tron</title>`
        ).replace(
            '--background-color: #F3F4F6;',
            `--background-color: ${bgColors[mode]};`
        ).replace(
            'Tutor-Tron AI Investigator',
            `${mode.charAt(0).toUpperCase() + mode.slice(1)} - Tutor-Tron`
        );

        return new Response(tutorHtml, {
            headers: { 'Content-Type': 'text/html' },
        });
    } catch (error) {
        console.error('Error serving tutor page:', error);
        return Response.redirect('/invalid-link.html', 302);
    }
});

// Update the tutor config route to only return the refined prompt
router.get('/api/tutor/:linkId', async (request, env) => {
    try {
        const { linkId } = request.params;
        console.log('Looking for link:', linkId);
        
        // Find teacher that has this link
        let foundLink = null;
        const teachersList = await env.TEACHERS.list();
        
        for (const key of teachersList.keys) {
            const teacherData = await env.TEACHERS.get(key.name);
            const teacher = JSON.parse(teacherData);
            
            if (teacher.links) {
                const link = teacher.links.find(l => l.id === linkId);
                if (link) {
                    foundLink = link;
                    break;
                }
            }
        }

        if (!foundLink) {
            console.log('Link not found:', linkId);
            return new Response(JSON.stringify({ message: 'Link not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log('Found link:', foundLink);
        return new Response(JSON.stringify({
            subject: foundLink.subject,
            prompt: foundLink.prompt,
            mode: foundLink.mode
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error getting tutor config:', error);
        return new Response(JSON.stringify({ message: 'Server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

// Add error reporting route
router.post('/api/report-error', async (request, env) => {
    try {
        const { error } = await request.json();
        
        // Get existing errors or create new file
        let errors = await env.FILES.get('error.txt') || '';
        
        // Append new error
        errors += error;
        
        // Save updated errors
        await env.FILES.put('error.txt', errors);

        return new Response(JSON.stringify({ message: 'Error reported' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ message: 'Failed to report error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

// Keep the catch-all route at the end
router.get('*', async (request, env) => {
  const url = new URL(request.url);
  
  // If it's an API request, return 404
  if (url.pathname.startsWith('/api/')) {
    return new Response('Not Found', { status: 404 });
  }
  
  // Serve static files
  return serveStaticFile(url, env);
});

export default {
  fetch: (request, env, ctx) => {
    // Make env available to the router
    router.env = env;
    return router.handle(request, env, ctx);
  }
}; 