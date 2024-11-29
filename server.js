import { Router } from 'itty-router';

const router = Router();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Update the getContentType function to properly handle CSS
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
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon'
  };
  return types[ext] || 'text/plain';
}

// Update serveStaticFile function to handle CSS properly
async function serveStaticFile(url, env) {
  const path = url.pathname.replace(/^\//, '') || 'index.html';
  
  try {
    const file = await env.FILES.get(path);
    if (file === null) {
      if (path.endsWith('/')) {
        const indexFile = await env.FILES.get(path + 'index.html');
        if (indexFile === null) {
          return new Response('Not Found', { status: 404 });
        }
        return new Response(indexFile, {
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=0'
          },
        });
      }
      return new Response('Not Found', { status: 404 });
    }
    
    const contentType = getContentType(path);
    return new Response(file, {
      headers: { 
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      },
    });
  } catch (error) {
    console.error('Error serving file:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Keep your original routes here...

// Simple catch-all route at the end
router.all('*', async (request, env) => {
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
    return router.handle(request, env, ctx);
  }
}; 