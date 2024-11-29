#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the project directory
cd "$SCRIPT_DIR"

# Run the backup script
./backup.sh

# Clean up old backups (keep last 3)
cd backups
ls -t | tail -n +4 | xargs rm -rf 2>/dev/null