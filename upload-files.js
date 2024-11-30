const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.txt': 'text/plain'
};

const filesToUpload = [
    'index.html',
    'index.css',
    'index.js',
    'css.js',
    'tutor.html',
    'tutor.css',
    'tutor.js',
    'invalid-link.html',
    'private-access-teachers-only.html',
    'pros-only-teachers.html',
    'register.js',
    'teacher-dashboard.js',
    'codebreaker.css',
    'code-highlighter.js',
    'style.css'
];

filesToUpload.forEach(file => {
    const filePath = path.join('public', file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const base64Content = Buffer.from(content).toString('base64');
        const ext = path.extname(file);
        const contentType = MIME_TYPES[ext] || 'text/plain';
        const dbPath = `public/${file}`;
        
        // Create a hash of the file content
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        
        const sql = `INSERT OR REPLACE INTO files (path, content, content_type, file_hash) VALUES ('${dbPath}', '${base64Content}', '${contentType}', '${hash}');`;
        
        try {
            execSync(`wrangler d1 execute tutortron --command "${sql}" --remote`, { stdio: 'inherit' });
            console.log(`Uploaded ${file}`);
        } catch (error) {
            console.error(`Failed to upload ${file}:`, error);
        }
    } else {
        console.error(`File not found: ${filePath}`);
    }
});
  