const { exec } = require('child_process');

console.log('Clearing KV databases...');

// Clear TEACHERS namespace
exec('npx wrangler kv:key list --binding=TEACHERS', (error, stdout, stderr) => {
    if (error) {
        console.error('Error listing TEACHERS keys:', error);
        return;
    }
    
    const keys = JSON.parse(stdout);
    keys.forEach(key => {
        exec(`npx wrangler kv:key delete --binding=TEACHERS "${key.name}"`, (err) => {
            if (err) console.error(`Error deleting TEACHERS key ${key.name}:`, err);
            else console.log(`Deleted TEACHERS key: ${key.name}`);
        });
    });
});

// Clear FILES namespace
exec('npx wrangler kv:key list --binding=FILES', (error, stdout, stderr) => {
    if (error) {
        console.error('Error listing FILES keys:', error);
        return;
    }
    
    const keys = JSON.parse(stdout);
    keys.forEach(key => {
        exec(`npx wrangler kv:key delete --binding=FILES "${key.name}"`, (err) => {
            if (err) console.error(`Error deleting FILES key ${key.name}:`, err);
            else console.log(`Deleted FILES key: ${key.name}`);
        });
    });
}); 