const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const path = require('path');

// Function to calculate MD5 hash of file
function calculateFileHash(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
}

// Function to get content type based on file extension
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.txt': 'text/plain'
    };
    return contentTypes[ext] || 'text/plain';
}

// Function to upload file using D1
async function uploadFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const contentType = getContentType(filePath);
        const fileHash = calculateFileHash(filePath);
        const base64Content = Buffer.from(content).toString('base64');
        
        // Create a temporary SQL file
        const sqlContent = `INSERT OR REPLACE INTO files (path, content, content_type, file_hash) VALUES ("${path.basename(filePath)}", "${base64Content}", "${contentType}", "${fileHash}");`;
        const tempSqlFile = `temp_${Date.now()}.sql`;
        fs.writeFileSync(tempSqlFile, sqlContent);
        
        const command = `wrangler d1 execute tutortron --file="${tempSqlFile}" --remote`;
        
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                // Clean up temp file
                fs.unlinkSync(tempSqlFile);
                
                if (error) {
                    console.error(`Error uploading ${filePath}:`, error);
                    reject(error);
                    return;
                }
                console.log(`Uploaded ${filePath}`);
                resolve();
            });
        });
    } catch (error) {
        console.error(`Error reading/uploading ${filePath}:`, error);
        throw error;
    }
}

// Main function to upload all files
async function uploadAllFiles() {
    const files = [
        'public/index.html',
        'public/tutor.html',
        'public/pros-only-teachers.html',
        'public/private-access-teachers-only.html',
        'public/tutor.css',
        'public/codebreaker.css',
        'public/index.css',
        'public/style.css',
        'public/tutor.js',
        'public/teacher-dashboard.js',
        'public/index.js',
        'public/css.js',
        'public/code-highlighter.js',
        'public/register.js'
    ];

    for (const file of files) {
        try {
            await uploadFile(file);
            console.log(`Successfully uploaded ${file}`);
            // Add a small delay between uploads
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Failed to upload ${file}:`, error);
        }
    }
}

// Run the upload
uploadAllFiles().catch(console.error);
  