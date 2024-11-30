const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');

// List of files to check from public directory
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

// Function to calculate file hash
function calculateFileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
}

// Function to encode content for SQL
function encodeForSQL(str) {
    return Buffer.from(str).toString('base64');
}

// Function to get current file hash from D1
async function getCurrentHash(filePath) {
    return new Promise((resolve, reject) => {
        const command = `wrangler d1 execute tutortron --command="SELECT file_hash FROM files WHERE path = '${filePath}';" --remote`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error getting hash for ${filePath}:`, error);
                resolve(null); // Return null if there's an error
                return;
            }
            
            try {
                const output = stdout.toString();
                const match = output.match(/│\s+([a-f0-9]{32})\s+│/);
                resolve(match ? match[1] : null);
            } catch (e) {
                console.error(`Error parsing hash for ${filePath}:`, e);
                resolve(null);
            }
        });
    });
}

// Function to upload file using D1
async function uploadFile(filePath) {
    try {
        const fullPath = `public/${filePath}`;
        
        // Calculate new hash
        const newHash = calculateFileHash(fullPath);
        
        // Get current hash
        const currentHash = await getCurrentHash(fullPath);
        
        // If hashes match, skip upload
        if (currentHash === newHash) {
            console.log(`Skipping ${filePath} - no changes detected`);
            return;
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        const contentType = getContentType(filePath);
        const encodedContent = encodeForSQL(content);
        
        const command = `wrangler d1 execute tutortron --command="INSERT OR REPLACE INTO files (path, content, content_type, file_hash) VALUES ('${fullPath}', '${encodedContent}', '${contentType}', '${newHash}');" --remote`;
        
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error uploading ${filePath}:`, error);
                    reject(error);
                    return;
                }
                console.log(`Uploaded ${filePath} - hash: ${newHash}`);
                resolve();
            });
        });
    } catch (error) {
        console.error(`Error reading/uploading ${filePath}:`, error);
        throw error;
    }
}

// Upload files sequentially
async function uploadFiles() {
    console.log('Starting file upload...');
    
    // First, ensure the table has the file_hash column
    const addHashColumnCommand = `wrangler d1 execute tutortron --command="ALTER TABLE files ADD COLUMN IF NOT EXISTS file_hash TEXT;" --remote`;
    
    try {
        await new Promise((resolve, reject) => {
            exec(addHashColumnCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('Error adding hash column:', error);
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    } catch (error) {
        console.error('Failed to add hash column:', error);
    }

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
  