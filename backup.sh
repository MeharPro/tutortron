#!/bin/bash

# Create backup directory with timestamp
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup main configuration files
cp wrangler.toml "$BACKUP_DIR/"
cp package.json "$BACKUP_DIR/"
cp server.js "$BACKUP_DIR/"

# Backup public directory
mkdir -p "$BACKUP_DIR/public"
cp public/*.{html,js,css,json} "$BACKUP_DIR/public/" 2>/dev/null

# Backup KV store data
echo "Backing up KV store..."
wrangler kv:key list --binding=FILES > "$BACKUP_DIR/kv_files_list.json"

# Create restore script
cat > "$BACKUP_DIR/restore.sh" << 'EOF'
#!/bin/bash

# Restore main configuration files
cp wrangler.toml ../
cp package.json ../
cp server.js ../

# Restore public directory files
cp public/* ../public/

# Restore KV store
while IFS= read -r line; do
    key=$(echo "$line" | jq -r '.name')
    if [ -f "public/$key" ]; then
        echo "Restoring $key to KV store..."
        wrangler kv:key put --binding=FILES "$key" --path="public/$key"
    fi
done < <(jq -c '.[]' kv_files_list.json)

echo "Restore complete!"
EOF

chmod +x "$BACKUP_DIR/restore.sh"

echo "Backup created in $BACKUP_DIR"
echo "To restore, cd into the backup directory and run ./restore.sh" 