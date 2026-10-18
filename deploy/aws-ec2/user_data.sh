#!/bin/bash
set -euo pipefail

# Log all output to /var/log/user-data.log
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "=========================================="
echo "Starting Andhera Raja Backend Provisioning"
echo "=========================================="

# 1. Update and install dependencies
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    nginx \
    docker.io

# 2. Enable and start Docker & Nginx
systemctl enable --now docker
systemctl enable --now nginx

# 3. Clone Repository
DEPLOY_DIR="/opt/andhera-raja"
rm -rf "$DEPLOY_DIR"
git clone https://github.com/Pushpa1raj/AndheraRaja.git "$DEPLOY_DIR"
cd "$DEPLOY_DIR/backend"

# 4. Generate Production .env if not already present
if [ ! -f .env ]; then
    cp .env.example .env
fi

# 5. Build and run Docker container
docker build -t andhera-raja-backend .
docker stop backend 2>/dev/null || true
docker rm backend 2>/dev/null || true

docker run -d \
  --name backend \
  --restart always \
  -p 127.0.0.1:8000:8000 \
  --env-file .env \
  andhera-raja-backend

# 6. Configure Nginx Reverse Proxy with WebSocket Support
cat <<'EOF' > /etc/nginx/sites-available/andhera-raja
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/andhera-raja /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=========================================="
echo "Andhera Raja Backend Provisioning Complete"
echo "=========================================="
