import { Router } from 'itty-router';

const router = Router();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Function to serve static files
async function serveStaticFile(url, env) {
  // Clean and normalize the path
  let path = url.pathname.slice(1) || 'index.html';
  console.log('Original request path:', url.pathname);
  console.log('Initial normalized path:', path);
  
  // Special handling for pros-only-teachers
  if (path === 'pros-only-teachers' || path === 'pros-only-teachers/') {
    console.log('Redirecting to pros-only-teachers.html');
    return Response.redirect(`${url.origin}/pros-only-teachers.html`, 302);
  }
  
  try {
    console.log('Attempting to fetch file:', path);
    const file = await env.FILES.get(path);
    if (file === null) {
      console.log('File not found:', path);
      return new Response('Not Found', { status: 404 });
    }
    
    const contentType = getContentType(path);
    console.log('File found! Serving:', path, 'with content type:', contentType);
    
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': path.endsWith('.css') ? 'no-cache' : 'public, max-age=3600'
    };
    
    return new Response(file, { headers });
  } catch (error) {
    console.error('Error serving file:', path, error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Helper function to determine content type
function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'eot': 'application/vnd.ms-fontobject'
  };
  return types[ext] || 'text/plain; charset=utf-8';
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

// Register route
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

    // Check if email exists
    const existingTeacher = await env.TEACHERS.get(email);
    if (existingTeacher) {
      return new Response(JSON.stringify({ message: 'Email already registered' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use master key for OpenRouter
    const openrouterKey = env.OPENROUTER_MASTER_KEY;

    // Create new teacher
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
    return new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Login route
router.post('/api/auth/login', async (request, env) => {
  try {
    const { email, password } = await request.json();
    console.log('Login attempt for:', email);

    // Get teacher from KV
    const teacherData = await env.TEACHERS.get(email);
    if (!teacherData) {
      console.log('Teacher not found:', email);
      return new Response(JSON.stringify({ message: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const teacher = JSON.parse(teacherData);
    if (teacher.password !== password) {
      console.log('Invalid password for:', email);
      return new Response(JSON.stringify({ message: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Login successful for:', email);
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
    return new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Get links route
router.get('/api/links', async (request, env) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.split(' ')[1];
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    const teacherId = decodedPayload.teacherId;

    // Find teacher by ID
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
      return new Response(JSON.stringify({ message: 'Teacher not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(foundTeacher.links || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get links error:', error);
    return new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Create link route
router.post('/api/links', async (request, env) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { subject, prompt, mode } = await request.json();
    const token = authHeader.split(' ')[1];
    
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    const teacherId = decodedPayload.teacherId;

    // Find teacher by ID
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
      return new Response(JSON.stringify({ message: 'Teacher not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    console.error('Create link error:', error);
    return new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Delete link route
router.delete('/api/links/:linkId', async (request, env) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.split(' ')[1];
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    const teacherId = decodedPayload.teacherId;

    // Find teacher by ID
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
      return new Response(JSON.stringify({ message: 'Teacher not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { linkId } = request.params;
    foundTeacher.links = foundTeacher.links.filter(link => link.id !== linkId);
    await env.TEACHERS.put(teacherKey, JSON.stringify(foundTeacher));

    return new Response(JSON.stringify({ message: 'Link deleted' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete link error:', error);
    return new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Get tutor config route
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
    let errors = await env.FILES.get('error.txt') || '';
    errors += error;
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

// Get API keys route
router.get('/api/keys', async (request, env) => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get array of API keys
    const apiKeys = env.OPENROUTER_API_KEYS.split(',');
    // Return random key from the array
    const randomKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

    return new Response(JSON.stringify({
      OPENROUTER_API_KEY: randomKey,
      DEEPGRAM_API_KEY: env.DEEPGRAM_API_KEY
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    return new Response(JSON.stringify({ message: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Add environment variables route
router.get('/api/env', async (request, env) => {
  return new Response(JSON.stringify({
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY || '',
    DEEPGRAM_API_KEY: env.DEEPGRAM_API_KEY || ''
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
});

// Handle tutor mode routes
router.get('/:mode/:linkId', async (request, env) => {
  try {
    const { mode, linkId } = request.params;
    console.log('Looking for link:', linkId, 'Mode:', mode);

    // Validate mode
    const validModes = ['investigator', 'comparitor', 'quest', 'codebreaker', 'eliminator'];
    if (!validModes.includes(mode)) {
      return Response.redirect('/invalid-link.html', 302);
    }

    // Validate linkId format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(linkId)) {
      console.log('Invalid link format:', linkId);
      return Response.redirect('/invalid-link.html', 302);
    }
    
    // Find teacher that has this link
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
      return Response.redirect('/invalid-link.html', 302);
    }

    console.log('Found link:', foundLink);

    // Get the tutor HTML
    let tutorHtml = await env.FILES.get('tutor.html');
    if (!tutorHtml) {
      return new Response('Tutor page not found', { status: 404 });
    }

    // Set background color based on mode
    const bgColors = {
      investigator: '#f0fdf4', // light green
      comparitor: '#eff6ff',   // light blue
      quest: '#fff1f2',        // light rose
      codebreaker: '#000000',  // black
      eliminator: '#1a0000'    // dark red
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

// Handle CORS preflight requests
router.options('*', () => new Response(null, { headers: corsHeaders }));

// Handle all routes
router.all('*', async (request, env) => {
  const url = new URL(request.url);
  console.log('Incoming request URL:', request.url);
  console.log('Pathname:', url.pathname);
  
  // API routes
  if (url.pathname.startsWith('/api/')) {
    console.log('Handling API request');
    return router.handle(request, env);
  }
  
  // Serve static files
  console.log('Handling static file request');
  return serveStaticFile(url, env);
});

export default {
  fetch: (request, env, ctx) => {
    router.env = env;
    return router.handle(request, env, ctx);
  }
}; 