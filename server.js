import { Router } from 'itty-router';

const router = Router();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Function to serve static files
async function serveStaticFile(url, env) {
  // Just get the path without any processing
  const path = url.pathname.slice(1) || 'index.html';
  
  try {
    const file = await env.FILES.get(path);
    if (file === null) {
      return new Response('Not Found', { status: 404 });
    }
    
    const contentType = getContentType(path);
    return new Response(file, {
      headers: { 'Content-Type': contentType }
    });
  } catch (error) {
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

// Handle all routes
router.all('*', async (request, env) => {
  const url = new URL(request.url);
  
  // API routes
  if (url.pathname.startsWith('/api/')) {
    return router.handle(request, env);
  }
  
  // Serve static files
  return serveStaticFile(url, env);
});

export default {
  fetch: (request, env, ctx) => {
    router.env = env;
    return router.handle(request, env, ctx);
  }
}; 