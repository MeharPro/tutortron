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

// Define all content variables first
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TutorTron - Teacher Login</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="index.css">
</head>
<body>
    <div class="container">
        <h1>TutorTron</h1>
        
        <div class="auth-container">
            <h2>Teacher Login</h2>
            <form id="loginForm">
                <div class="form-group">
                    <label for="loginEmail">Email</label>
                    <input type="email" id="loginEmail" required>
                </div>
                <div class="form-group">
                    <label for="loginPassword">Password</label>
                    <input type="password" id="loginPassword" required>
                </div>
                <button type="submit">Login</button>
                <div id="loginMessage"></div>
            </form>
        </div>
    </div>

    <script src="css.js"></script>
    <script src="index.js"></script>
</body>
</html>`;

const privateAccessTeachersHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TutorTron - Teacher Registration</title>
    <link rel="stylesheet" href="style.css">
    <style>
        .auth-container {
            max-width: 400px;
            margin: 50px auto;
            padding: 2rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .form-group {
            margin-bottom: 1.5rem;
        }
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }
        .form-group input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 1rem;
        }
        button {
            width: 100%;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>TutorTron</h1>
        <h2>Teacher Registration</h2>
        
        <div class="auth-container">
            <form id="registerForm">
                <div class="form-group">
                    <label for="registerName">Full Name</label>
                    <input type="text" id="registerName" required>
                </div>
                <div class="form-group">
                    <label for="registerEmail">Email</label>
                    <input type="email" id="registerEmail" required>
                </div>
                <div class="form-group">
                    <label for="registerPassword">Password</label>
                    <input type="password" id="registerPassword" required>
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <input type="password" id="confirmPassword" required>
                </div>
                <div class="form-group">
                    <label for="registerSchool">School/Institution</label>
                    <input type="text" id="registerSchool" required>
                </div>
                <div class="form-group">
                    <label for="accessCode">Access Code</label>
                    <input type="text" id="accessCode" required>
                </div>
                <button type="submit">Register</button>
                <div id="registerMessage"></div>
            </form>
        </div>
    </div>

    <script src="register.js"></script>
</body>
</html>`;

const prosOnlyTeachersHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TutorTron - Teacher Dashboard</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        :root {
            --primary-color: #4F46E5;
            --secondary-color: #818CF8;
            --background-color: #F3F4F6;
            --text-color: #1F2937;
            --success-color: #059669;
            --error-color: #DC2626;
        }

        .mode-tabs {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
        }

        .mode-tab {
            padding: 1rem 2rem;
            background: white;
            border: 2px solid transparent;
            border-radius: 0.75rem;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.3s ease;
            position: relative;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .mode-tab i {
            font-size: 1.2rem;
        }

        .mode-tab:hover {
            border-color: var(--primary-color);
        }

        .mode-tab.active {
            background: var(--primary-color);
            color: white;
        }

        .mode-panel {
            display: none;
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            margin-bottom: 2rem;
        }

        .mode-panel.active {
            display: block;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-group label {
            display: block;
            font-weight: 500;
            margin-bottom: 0.5rem;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #E5E7EB;
            border-radius: 0.75rem;
            font-size: 1rem;
        }

        button {
            padding: 0.75rem 1.5rem;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 0.75rem;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
        }

        #linksList {
            margin-top: 2rem;
        }

        .link-item {
            background: white;
            padding: 1rem;
            border-radius: 0.75rem;
            margin-bottom: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>TutorTron Teacher Dashboard</h1>
        
        <div class="mode-tabs">
            <div class="mode-tab" data-panel="#investigator-panel">
                <i class="fas fa-search"></i>
                Investigator
            </div>
            <div class="mode-tab" data-panel="#comparitor-panel">
                <i class="fas fa-balance-scale"></i>
                Comparitor
            </div>
            <div class="mode-tab" data-panel="#quest-panel">
                <i class="fas fa-question-circle"></i>
                Quest
            </div>
            <div class="mode-tab" data-panel="#codebreaker-panel">
                <i class="fas fa-code"></i>
                Codebreaker
            </div>
            <div class="mode-tab" data-panel="#eliminator-panel">
                <i class="fas fa-times-circle"></i>
                Eliminator
            </div>
        </div>

        <div id="investigator-panel" class="mode-panel">
            <h2>Create Investigator Link</h2>
            <form id="investigatorForm">
                <div class="form-group">
                    <label for="investigatorSubject">Subject</label>
                    <input type="text" id="investigatorSubject" required>
                </div>
                <div class="form-group">
                    <label for="investigatorPrompt">Prompt</label>
                    <textarea id="investigatorPrompt" rows="4" required></textarea>
                </div>
                <button type="submit">Create Link</button>
            </form>
        </div>

        <div id="comparitor-panel" class="mode-panel">
            <h2>Create Comparitor Link</h2>
            <form id="comparitorForm">
                <div class="form-group">
                    <label for="comparitorSubject">Subject</label>
                    <input type="text" id="comparitorSubject" required>
                </div>
                <div class="form-group">
                    <label for="comparitorPrompt">Prompt</label>
                    <textarea id="comparitorPrompt" rows="4" required></textarea>
                </div>
                <button type="submit">Create Link</button>
            </form>
        </div>

        <div id="quest-panel" class="mode-panel">
            <h2>Create Quest Link</h2>
            <form id="questForm">
                <div class="form-group">
                    <label for="questSubject">Subject</label>
                    <input type="text" id="questSubject" required>
                </div>
                <div class="form-group">
                    <label for="questPrompt">Prompt</label>
                    <textarea id="questPrompt" rows="4" required></textarea>
                </div>
                <button type="submit">Create Link</button>
            </form>
        </div>

        <div id="codebreaker-panel" class="mode-panel">
            <h2>Create Codebreaker Link</h2>
            <form id="codebreakerForm">
                <div class="form-group">
                    <label for="codebreakerSubject">Subject</label>
                    <input type="text" id="codebreakerSubject" required>
                </div>
                <div class="form-group">
                    <label for="codebreakerLanguage">Programming Language</label>
                    <select id="codebreakerLanguage" required>
                        <option value="python">Python</option>
                        <option value="javascript">JavaScript</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="codebreakerPrompt">Prompt</label>
                    <textarea id="codebreakerPrompt" rows="4" required></textarea>
                </div>
                <button type="submit">Create Link</button>
            </form>
        </div>

        <div id="eliminator-panel" class="mode-panel">
            <h2>Create Eliminator Link</h2>
            <form id="eliminatorForm">
                <div class="form-group">
                    <label for="eliminatorSubject">Subject</label>
                    <input type="text" id="eliminatorSubject" required>
                </div>
                <div class="form-group">
                    <label for="eliminatorPrompt">Prompt</label>
                    <textarea id="eliminatorPrompt" rows="4" required></textarea>
                </div>
                <button type="submit">Create Link</button>
            </form>
        </div>

        <div id="linksList"></div>
    </div>

    <script src="teacher-dashboard.js"></script>
</body>
</html>`;

const styleCSS = `
body {
    margin: 0;
    padding: 0;
    font-family: 'Arial', sans-serif;
    background-color: #f5f5f5;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

h1 {
    color: #333;
    text-align: center;
}

.auth-container {
    max-width: 400px;
    margin: 50px auto;
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    color: #333;
}

.form-group input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-sizing: border-box;
}

button {
    width: 100%;
    padding: 10px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

button:hover {
    background-color: #45a049;
}
`;

const indexCSS = `
.login-container {
    max-width: 400px;
    margin: 50px auto;
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
`;

const indexJS = `
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const messageDiv = document.getElementById('loginMessage');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            messageDiv.textContent = 'Login successful!';
            messageDiv.style.color = 'green';
            window.location.href = '/pros-only-teachers';
        } else {
            messageDiv.textContent = data.error || 'Login failed';
            messageDiv.style.color = 'red';
        }
    } catch (error) {
        messageDiv.textContent = 'An error occurred';
        messageDiv.style.color = 'red';
        console.error('Login error:', error);
    }
});
`;

const registerJS = `
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('registerMessage');
    
    if (password !== confirmPassword) {
        messageDiv.textContent = 'Passwords do not match';
        messageDiv.style.color = 'red';
        return;
    }
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            messageDiv.textContent = 'Registration successful!';
            messageDiv.style.color = 'green';
            window.location.href = '/pros-only-teachers';
        } else {
            messageDiv.textContent = data.error || 'Registration failed';
            messageDiv.style.color = 'red';
        }
    } catch (error) {
        messageDiv.textContent = 'An error occurred';
        messageDiv.style.color = 'red';
        console.error('Registration error:', error);
    }
});
`;

const teacherDashboardJS = `
document.addEventListener('DOMContentLoaded', async () => {
    // Handle tab switching
    const tabs = document.querySelectorAll('.mode-tab');
    const panels = document.querySelectorAll('.mode-panel');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and panels
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding panel
            tab.classList.add('active');
            const panelId = tab.getAttribute('data-panel');
            document.querySelector(panelId).classList.add('active');
        });
    });

    // Initialize first tab as active
    if (tabs.length > 0) {
        tabs[0].click();
    }

    // Handle form submissions
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mode = form.id.replace('Form', '');
            const subject = document.getElementById(\`\${mode}Subject\`).value;
            const prompt = document.getElementById(\`\${mode}Prompt\`).value;
            const language = mode === 'codebreaker' ? 
                document.getElementById('codebreakerLanguage').value : null;

            try {
                const response = await fetch('/api/links', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ mode, subject, prompt, language })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Link created successfully!');
                    form.reset();
                    await loadLinks(); // Refresh links list
                } else {
                    alert(data.error || 'Failed to create link');
                }
            } catch (error) {
                console.error('Error creating link:', error);
                alert('An error occurred while creating the link');
            }
        });
    });

    // Load and display links
    async function loadLinks() {
        try {
            const response = await fetch('/api/links');
            if (!response.ok) throw new Error('Failed to load links');
            
            const links = await response.json();
            const linksList = document.getElementById('linksList');
            linksList.innerHTML = '<h2>Your Links</h2>';

            links.forEach(link => {
                const linkElement = document.createElement('div');
                linkElement.className = 'link-item';
                linkElement.innerHTML = \`
                    <div class="link-info">
                        <strong>\${link.subject}</strong>
                        <p>\${link.mode}</p>
                        <div class="link-url">https://tutortron.dizon-dzn12.workers.dev/\${link.mode}/\${link.id}</div>
                    </div>
                    <div class="link-actions">
                        <button onclick="copyLink('\${link.mode}/\${link.id}')" class="copy-btn">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                        <button onclick="deleteLink(\${link.id})" class="delete-btn">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                \`;
                linksList.appendChild(linkElement);
            });
        } catch (error) {
            console.error('Error loading links:', error);
        }
    }

    // Copy link function
    window.copyLink = async (path) => {
        try {
            const url = \`https://tutortron.dizon-dzn12.workers.dev/\${path}\`;
            await navigator.clipboard.writeText(url);
            alert('Link copied to clipboard!');
        } catch (error) {
            console.error('Error copying link:', error);
            alert('Failed to copy link');
        }
    };

    // Delete link function
    window.deleteLink = async (id) => {
        if (!confirm('Are you sure you want to delete this link?')) return;

        try {
            const response = await fetch(\`/api/links/\${id}\`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await loadLinks(); // Refresh links list
                alert('Link deleted successfully!');
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to delete link');
            }
        } catch (error) {
            console.error('Error deleting link:', error);
            alert('An error occurred while deleting the link');
        }
    };

    // Load initial links
    await loadLinks();
});
`;

// Login endpoint
router.post('/api/auth/login', async (request, env) => {
  try {
    // Parse request body
    const { email, password } = await request.json();
    
    console.log('Login attempt for email:', email);

    if (!email || !password) {
      return new Response(JSON.stringify({ 
        error: 'Email and password are required' 
      }), {
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      });
    }

    // Query the database
    const { results } = await env.DB.prepare(
      'SELECT * FROM teachers WHERE email = ?'
    ).bind(email).all();

    console.log('Database query results:', results);

    const teacher = results && results[0];
    
    if (!teacher) {
      return new Response(JSON.stringify({ 
        error: 'Invalid credentials',
        debug: 'Teacher not found' 
      }), {
        status: 401,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      });
    }

    // Verify password
    if (password !== teacher.password) {
      return new Response(JSON.stringify({ 
        error: 'Invalid credentials',
        debug: 'Password mismatch' 
      }), {
        status: 401,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      });
    }

    // Create token
    const token = btoa(JSON.stringify({
      id: teacher.id,
      email: teacher.email,
      exp: Date.now() + (3600 * 1000) // 1 hour expiration
    }));
    
    // Return success response
    return new Response(JSON.stringify({ 
      success: true,
      token: token,
      teacher: {
        email: teacher.email,
        name: teacher.name
      }
    }), {
      status: 200,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': `token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      }
    });
  }
});

// Authentication middleware
async function authenticate(request, env) {
  try {
    const token = request.headers.get('Cookie')?.match(/token=([^;]+)/)?.[1] ||
                 request.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) return null;

    const payload = JSON.parse(atob(token));
    
    // Check expiration
    if (payload.exp < Date.now()) return null;

    // Verify user exists in database
    const { results } = await env.DB.prepare(
      'SELECT * FROM teachers WHERE id = ? AND email = ?'
    ).bind(payload.id, payload.email).all();

    return results && results[0];
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

// Registration endpoint
router.post('/api/auth/register', async (request, env) => {
  try {
    const { email, password, name } = await request.json();
    
    if (!email || !password || !name) {
      return new Response(JSON.stringify({ 
        error: 'All fields are required' 
      }), {
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      });
    }

    // Check if teacher already exists
    const existingTeacher = await env.DB.prepare(
      'SELECT id FROM teachers WHERE email = ?'
    ).bind(email).first();

    if (existingTeacher) {
      return new Response(JSON.stringify({ 
        error: 'Email already registered' 
      }), {
        status: 409,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      });
    }

    // Insert new teacher
    const result = await env.DB.prepare(
      'INSERT INTO teachers (email, password, name) VALUES (?, ?, ?)'
    ).bind(email, password, name).run();

    if (!result.success) {
      throw new Error('Failed to insert new teacher');
    }

    // Get the newly created teacher
    const newTeacher = await env.DB.prepare(
      'SELECT * FROM teachers WHERE email = ?'
    ).bind(email).first();

    // Create token
    const token = btoa(JSON.stringify({
      id: newTeacher.id,
      email: newTeacher.email,
      exp: Date.now() + (3600 * 1000) // 1 hour expiration
    }));

    return new Response(JSON.stringify({ 
      success: true,
      token: token,
      teacher: {
        email: newTeacher.email,
        name: newTeacher.name
      }
    }), {
      status: 200,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': `token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      }
    });
  }
});

// Get links endpoint
router.get('/api/links', async (request, env) => {
  try {
    console.log('GET /api/links - Start');
    
    // Check authentication
    const user = await authenticate(request, env);
    console.log('Authentication result:', user ? 'authenticated' : 'not authenticated');
    
    if (!user) {
      console.log('Unauthorized access to /api/links');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    console.log('Authenticated user:', user);

    // Get all links for the user
    try {
      const stmt = env.DB.prepare(`
        SELECT id, mode, subject, prompt, language, created_at
        FROM links 
        WHERE created_by = ?
        ORDER BY created_at DESC
      `);
      console.log('Prepared statement for user:', user.email);
      
      const { results } = await stmt.bind(user.email).all();
      console.log('Query results:', results);

      return new Response(JSON.stringify(results || []), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (queryError) {
      console.error('Error querying links:', queryError);
      throw queryError;
    }
  } catch (error) {
    console.error('Error in /api/links:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch links',
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

// Create link endpoint
router.post('/api/links', async (request, env) => {
  try {
    console.log('POST /api/links - Start');
    
    // Check authentication
    const user = await authenticate(request, env);
    console.log('Authentication result:', user ? 'authenticated' : 'not authenticated');
    
    if (!user) {
      console.log('Unauthorized attempt to create link');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const body = await request.json();
    console.log('Request body:', body);
    
    const { mode, subject, prompt, language } = body;
    
    if (!mode || !subject || !prompt) {
      console.log('Missing required fields:', { mode, subject, prompt });
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

    // Insert the new link
    try {
      // Generate a unique ID
      const id = crypto.randomUUID();
      
      const insertStmt = env.DB.prepare(`
        INSERT INTO links (id, mode, subject, prompt, language, created_by) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      console.log('Insert statement prepared');
      
      const result = await insertStmt.bind(
        id,
        mode,
        subject,
        prompt,
        language || null,
        user.email
      ).run();
      console.log('Insert result:', result);

      if (!result.success) {
        throw new Error('Failed to insert link');
      }

      // Get the newly created link
      const selectStmt = env.DB.prepare(`
        SELECT id, mode, subject, prompt, language, created_at
        FROM links 
        WHERE id = ?
      `);
      console.log('Select statement prepared');
      
      const { results } = await selectStmt.bind(id).all();
      console.log('Select results:', results);

      return new Response(JSON.stringify({ 
        success: true,
        link: results[0]
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Error in POST /api/links:', error);
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
    
    // Verify the link belongs to the user
    const link = await env.DB.prepare(
      'SELECT id FROM links WHERE id = ? AND teacher_id = ?'
    ).bind(id, user.id).first();

    if (!link) {
      return new Response(JSON.stringify({ error: 'Link not found' }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Delete the link
    const result = await env.DB.prepare(
      'DELETE FROM links WHERE id = ? AND teacher_id = ?'
    ).bind(id, user.id).run();

    if (!result.success) {
      throw new Error('Failed to delete link');
    }

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
      details: error.message 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

// Handle OPTIONS for all API routes
router.options('/api/*', () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
});

// Handle all routes
router.all('*', async (request, env) => {
  const url = new URL(request.url);
  console.log('Incoming request for:', url.pathname);

  // Handle API routes first
  if (url.pathname.startsWith('/api/')) {
    return router.handle(request, env);
  }

  // Check authentication
  const user = await authenticate(request, env);
  console.log('Auth status:', user ? 'authenticated' : 'not authenticated');

  // For root path or any unrecognized path, redirect to index.html if not authenticated
  if (url.pathname === '/' || (!user && !url.pathname.endsWith('.css') && !url.pathname.endsWith('.js'))) {
    return new Response(indexHtml, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // If authenticated and at root, redirect to dashboard
  if (user && url.pathname === '/') {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/pros-only-teachers' }
    });
  }

  // Protected routes require authentication
  if (url.pathname === '/pros-only-teachers' || url.pathname === '/pros-only-teachers.html') {
    if (!user) {
      return new Response(indexHtml, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    return new Response(prosOnlyTeachersHtml, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Public registration page
  if (url.pathname === '/private-access-teachers-only' || url.pathname === '/private-access-teachers-only.html') {
    return new Response(privateAccessTeachersHtml, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Handle static files
  const path = url.pathname.slice(1);
  try {
    const contentType = getContentType(path);
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    };

    let content = null;
    switch(path) {
      case 'style.css':
        content = styleCSS;
        break;
      case 'index.css':
        content = indexCSS;
        break;
      case 'index.js':
        content = indexJS;
        break;
      case 'register.js':
        content = registerJS;
        break;
      case 'teacher-dashboard.js':
        content = teacherDashboardJS;
        break;
      default:
        return new Response('Not Found', { status: 404 });
    }

    return new Response(content, { headers });
  } catch (error) {
    console.error('Error serving file:', path, error);
    return new Response('Internal Server Error', { status: 500 });
  }
});

// Helper function to get content type
function getContentType(path) {
  const ext = path.split('.').pop().toLowerCase();
  const types = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml'
  };
  return types[ext] || 'text/plain';
}

export default {
  fetch: (request, env) => router.handle(request, env)
};