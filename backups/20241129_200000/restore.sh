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
