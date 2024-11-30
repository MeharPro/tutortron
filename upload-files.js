const fs = require('fs');
const crypto = require('crypto');
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
    'style.css',
    'accounts.txt',
    'links.txt'
];

// List of files to upload from root directory
const rootFiles = [
    'server.js'
];

// Function to calculate file hash
function calculateHash(filePath, isRoot = false) {
    try {
        const content = fs.readFileSync(isRoot ? filePath : `public/${filePath}`);
        return crypto.createHash('md5').update(content).digest('hex');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return null;
    }
}

// Function to upload file using wrangler
async function uploadFile(filePath, isRoot = false) {
    const fullPath = isRoot ? filePath : `public/${filePath}`;
    exec(`wrangler kv:key put --binding=FILES "${filePath}" --path="${fullPath}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error uploading ${filePath}:`, error);
            return;
        }
        console.log(`Uploaded ${filePath}`);
    });
}

// Function to ensure data files exist
function ensureDataFiles() {
    const files = ['accounts.txt', 'links.txt'];
    files.forEach(file => {
        const path = `public/${file}`;
        if (!fs.existsSync(path)) {
            fs.writeFileSync(path, '{}', 'utf8');
            console.log(`Created empty ${file}`);
        }
    });
}

// Ensure data files exist before uploading
ensureDataFiles();

// Upload all files
console.log('Starting file upload...');
publicFiles.forEach(file => uploadFile(file));
rootFiles.forEach(file => uploadFile(file, true)); 