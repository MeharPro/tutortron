const { exec } = require('child_process');

// API keys to upload
const apiKeys = {
    'OPENROUTER_API_KEY': 'sk-or-v1-...',  // Replace with your actual API key
    'OPENAI_API_KEY': 'sk-...',  // Replace with your actual API key
    // Add any other API keys here
};

// Function to upload API key to D1
function uploadApiKey(keyName, keyValue) {
    return new Promise((resolve, reject) => {
        const command = `wrangler d1 execute tutortron --command="INSERT OR REPLACE INTO api_keys (key_name, key_value) VALUES ('${keyName}', '${keyValue}');" --remote`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error uploading ${keyName}:`, error);
                reject(error);
                return;
            }
            console.log(`Uploaded ${keyName}`);
            resolve();
        });
    });
}

// Upload API keys sequentially
async function uploadApiKeys() {
    console.log('Starting API key upload...');
    for (const [keyName, keyValue] of Object.entries(apiKeys)) {
        try {
            await uploadApiKey(keyName, keyValue);
            // Add a small delay between uploads
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`Failed to upload ${keyName}:`, error);
        }
    }
    console.log('API key upload complete');
}

// Start the upload process
uploadApiKeys(); 