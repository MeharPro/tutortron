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
    'style.css'
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

// Process public files
publicFiles.forEach(file => {
    const hash = calculateHash(file);
    if (hash) {
        const oldHash = process.env[`HASH_${file.replace(/\./g, '_')}`];
        if (hash !== oldHash) {
            uploadFile(file);
            process.env[`HASH_${file.replace(/\./g, '_')}`] = hash;
        } else {
            console.log(`Skipping unchanged file: ${file}`);
        }
    }
});

// Process root files
rootFiles.forEach(file => {
    const hash = calculateHash(file, true);
    if (hash) {
        const oldHash = process.env[`HASH_${file.replace(/\./g, '_')}`];
        if (hash !== oldHash) {
            uploadFile(file, true);
            process.env[`HASH_${file.replace(/\./g, '_')}`] = hash;
        } else {
            console.log(`Skipping unchanged file: ${file}`);
        }
    }
}); 