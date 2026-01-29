#!/bin/bash
echo "Making destination directory..."
ssh root@188.166.234.77 "mkdir -p ~/app-sikamu-api"

echo "Copying files to 188.166.234.77..."
scp -r server.js package.json services root@188.166.234.77:~/app-sikamu-api/

echo "Files transferred successfully."
echo "Now you can SSH into the server and run 'npm install' and 'pm2 start server.js'"
