const fs = require('fs');
const { exec } = require('child_process');

// List of files to upload from public directory
const publicFiles = [
    'index.html',
    'tutor.html',
    'pros-only-teachers.html',
    'private-access-teachers-only.html',
    'invalid-link.html',
    'css.js',
    'tutor.js',
    'teacher-dashboard.js',
    'register.js',
    'index.js',
    'tutor.css',
    'codebreaker.css',
    'index.css',
    'style.css'
];

// Function to get content type
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

// Function to encode content for SQL
function encodeForSQL(str) {
    return Buffer.from(str).toString('base64');
}

// Function to upload file using D1
function uploadFile(filePath) {
    return new Promise((resolve, reject) => {
        try {
            const fullPath = `public/${filePath}`;
            const content = fs.readFileSync(fullPath, 'utf8');
            const contentType = getContentType(filePath);
            const encodedContent = encodeForSQL(content);
            
            const command = `wrangler d1 execute tutortron --command="INSERT OR REPLACE INTO files (path, content, content_type) VALUES ('${fullPath}', '${encodedContent}', '${contentType}');"`;
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error uploading ${filePath}:`, error);
                    reject(error);
                    return;
                }
                console.log(`Uploaded ${filePath}`);
                resolve();
            });
        } catch (error) {
            console.error(`Error reading/uploading ${filePath}:`, error);
            reject(error);
        }
    });
}

// Upload files sequentially
async function uploadFiles() {
    console.log('Starting file upload...');
    for (const file of publicFiles) {
        try {
            await uploadFile(file);
            // Add a small delay between uploads
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Failed to upload ${file}:`, error);
        }
    }
    console.log('File upload complete');
}

// Start the upload process
uploadFiles();
  