#!/bin/bash

# Run backup before deployment
echo "Creating backup before deployment..."
./auto-backup.sh

# Create the output directory
mkdir -p dist

# Copy all static files
cp -r public/* dist/

# Copy server files
cp server.js dist/

# Function to get file hash
get_file_hash() {
    shasum -a 256 "$1" | cut -d' ' -f1
}

# Load previous hashes
HASH_FILE=".file-hashes.json"
if [ ! -f "$HASH_FILE" ]; then
    echo "{}" > "$HASH_FILE"
fi

# Sync files to KV storage, but only if changed
echo "Syncing changed files to KV storage..."

# Function to check and upload file if changed
check_and_upload() {
    local file="$1"
    local filename="$2"
    if [ -f "$file" ]; then
        current_hash=$(get_file_hash "$file")
        stored_hash=$(cat "$HASH_FILE" | jq -r ".[\"$filename\"]")
        
        if [ "$stored_hash" = "null" ] || [ "$current_hash" != "$stored_hash" ]; then
            echo "Changes detected in $filename, uploading..."
            wrangler kv:key put --binding=FILES "$filename" --path="$file"
            # Update hash in temporary file
            jq ".[\"$filename\"] = \"$current_hash\"" "$HASH_FILE" > "$HASH_FILE.tmp" && mv "$HASH_FILE.tmp" "$HASH_FILE"
        else
            echo "No changes in $filename, skipping..."
        fi
    fi
}

# Check public directory files
for file in public/*; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        check_and_upload "$file" "$filename"
    fi
done

# Check root JS files
for file in *.js; do
    if [ -f "$file" ] && [ "$file" != "server.js" ]; then
        check_and_upload "$file" "$file"
    fi
done

# Deploy using wrangler
echo "Deploying to Cloudflare Workers..."
wrangler deploy 