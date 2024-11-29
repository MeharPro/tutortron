const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

const publicDir = path.join(__dirname, 'public');
const hashFile = '.file-hashes.json';

// Essential files that need to be in KV storage
const essentialFiles = [
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
    'server.js'
];

// Load previous file hashes
let previousHashes = {};
try {
    if (fs.existsSync(hashFile)) {
        previousHashes = JSON.parse(fs.readFileSync(hashFile, 'utf8'));
    }
} catch (error) {
    console.log('No previous hash file found, will upload all essential files');
}

// Function to calculate file hash
function calculateHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

// Get all files from public directory
const files = essentialFiles.map(file => path.join(publicDir, file));
const currentHashes = {};
let uploadCount = 0;
let skipCount = 0;

// Upload each modified essential file to KV
files.forEach(file => {
   // if (!fs.existsSync(file) || file.endsWith('.env')) {
     //   console.log(`Skipping file: ${file}`);
     //   return;
    //}

    const relativePath = path.relative(publicDir, file).replace(/\\/g, '/');
    const currentHash = calculateHash(file);
    currentHashes[relativePath] = currentHash;

    // Check if file has changed
    if (previousHashes[relativePath] !== currentHash) {
        const command = `npx wrangler kv:key put --binding=FILES "${relativePath}" --path="${file}"`;
        
        console.log(`Uploading modified file: ${relativePath}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error uploading ${relativePath}:`, error);
                return;
            }
            console.log(`Successfully uploaded ${relativePath}`);
            if (stderr) console.error(stderr);
        });
        uploadCount++;
    } else {
        console.log(`Skipping unchanged file: ${relativePath}`);
        skipCount++;
    }
});

// Save current hashes for next time
fs.writeFileSync(hashFile, JSON.stringify(currentHashes, null, 2));

console.log(`\nUpload Summary:`);
console.log(`Essential files checked: ${files.length}`);
console.log(`Files uploaded: ${uploadCount}`);
console.log(`Files skipped: ${skipCount}`); 