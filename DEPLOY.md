# Deployment Guide

Complete guide for deploying the RightStep Monitoring System.

## Quick Deploy (Local Development)

### 1. Start SigNoz (Terminal 1)

```bash
cd /Users/rightsteps/Developer/montitor/signoz/deploy
./install.sh

# Verify
open http://localhost:8080
```

### 2. Start Express App (Terminal 2)

```bash
cd /Users/rightsteps/Developer/montitor/app
npm install
npm start

# Test
curl http://localhost:3000/health
```

### 3. Start GitHub Service (Terminal 3)

```bash
cd /Users/rightsteps/Developer/montitor/github-service
npm install

# Create .env
cat > .env << EOF
GITHUB_TOKEN=ghp_your_token_here
GITHUB_OWNER=your-username
GITHUB_REPO=montitor
PORT=3001
LOG_LEVEL=info
EOF

npm start

# Test
curl http://localhost:3001/health
```

### 4. Start AI Analyzer (Terminal 4)

```bash
cd /Users/rightsteps/Developer/montitor/ai-analyzer
npm install

# Create .env
cat > .env << EOF
OPENAI_API_KEY=sk-proj-your_key_here
AI_MODEL=gpt-4-turbo-preview
SIGNOZ_URL=http://localhost:3301
SERVICE_NAME=rightstep-app
GITHUB_SERVICE_URL=http://localhost:3001
REPO_URL=https://github.com/your-username/montitor
POLLING_INTERVAL=300000
CHECK_INTERVAL=15
LOG_LEVEL=info
EOF

npm start
```

### 5. Configure n8n

Follow [n8n-workflow-guide.md](./n8n-workflow-guide.md)

## Production Deployment with PM2

### 1. Install PM2

```bash
npm install -g pm2
```

### 2. Create PM2 Ecosystem File

```bash
cd /Users/rightsteps/Developer/montitor

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'app',
      cwd: './app',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'github-service',
      cwd: './github-service',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'ai-analyzer',
      cwd: './ai-analyzer',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF
```

### 3. Start All Services

```bash
pm2 start ecosystem.config.js

# Save configuration
pm2 save

# Setup auto-start on reboot
pm2 startup
```

### 4. Monitor Services

```bash
# View status
pm2 status

# View logs
pm2 logs

# View specific service logs
pm2 logs app
pm2 logs github-service
pm2 logs ai-analyzer

# Monitor in real-time
pm2 monit
```

### 5. Manage Services

```bash
# Restart all
pm2 restart all

# Restart specific service
pm2 restart app

# Stop all
pm2 stop all

# Delete all
pm2 delete all
```

## Docker Deployment

### 1. Create Dockerfiles

**App Dockerfile:**
```dockerfile
# app/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

**GitHub Service Dockerfile:**
```dockerfile
# github-service/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```

**AI Analyzer Dockerfile:**
```dockerfile
# ai-analyzer/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["node", "index.js"]
```

### 2. Create Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: ./app
    container_name: rightstep-app
    ports:
      - "3000:3000"
    environment:
      - OTEL_SERVICE_NAME=rightstep-app
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector:4318
      - PORT=3000
    restart: unless-stopped
    networks:
      - monitoring

  github-service:
    build: ./github-service
    container_name: github-service
    ports:
      - "3001:3001"
    env_file:
      - ./github-service/.env
    restart: unless-stopped
    networks:
      - monitoring

  ai-analyzer:
    build: ./ai-analyzer
    container_name: ai-analyzer
    env_file:
      - ./ai-analyzer/.env
    environment:
      - SIGNOZ_URL=http://signoz-query-service:8080
      - GITHUB_SERVICE_URL=http://github-service:3001
    restart: unless-stopped
    depends_on:
      - github-service
    networks:
      - monitoring

networks:
  monitoring:
    external: true
    name: signoz_default
```

### 3. Deploy with Docker Compose

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Cloud Deployment (AWS Example)

### 1. Setup EC2 Instance

```bash
# Launch Ubuntu 22.04 instance
# Instance type: t3.medium or larger
# Security groups: Open ports 22, 3000, 3001, 8080
```

### 2. Install Dependencies

```bash
# SSH into instance
ssh ubuntu@your-instance-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install PM2
sudo npm install -g pm2
```

### 3. Clone Repository

```bash
git clone https://github.com/your-username/montitor.git
cd montitor
```

### 4. Setup Environment Variables

```bash
# Create .env files for each service
cd app && cp .env.example .env && nano .env
cd ../github-service && cp .env.example .env && nano .env
cd ../ai-analyzer && cp .env.example .env && nano .env
```

### 5. Install Dependencies

```bash
cd /home/ubuntu/montitor/app && npm install
cd /home/ubuntu/montitor/github-service && npm install
cd /home/ubuntu/montitor/ai-analyzer && npm install
```

### 6. Start Services

```bash
cd /home/ubuntu/montitor
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 7. Setup Nginx Reverse Proxy

```bash
sudo apt-get install nginx

# Create config
sudo nano /etc/nginx/sites-available/montitor
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/github/ {
        proxy_pass http://localhost:3001/api/;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/montitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. Setup SSL with Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Monitoring Production

### PM2 Monitoring

```bash
# Install PM2 Plus (optional)
pm2 install pm2-logrotate

# Setup log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Health Checks

Create a monitoring script:

```bash
# health-check.sh
#!/bin/bash

check_service() {
    SERVICE=$1
    URL=$2

    STATUS=$(curl -s -o /dev/null -w "%{http_code}" $URL)

    if [ $STATUS -eq 200 ]; then
        echo "✅ $SERVICE is healthy"
    else
        echo "❌ $SERVICE is down (HTTP $STATUS)"
        pm2 restart $SERVICE
    fi
}

check_service "app" "http://localhost:3000/health"
check_service "github-service" "http://localhost:3001/health"
```

```bash
chmod +x health-check.sh

# Add to crontab (run every 5 minutes)
crontab -e
```

```cron
*/5 * * * * /home/ubuntu/montitor/health-check.sh >> /var/log/health-check.log 2>&1
```

## Backup and Recovery

### Backup Environment Files

```bash
# Backup .env files (encrypted)
tar -czf env-backup.tar.gz \
    app/.env \
    github-service/.env \
    ai-analyzer/.env

# Encrypt
gpg -c env-backup.tar.gz

# Store securely (S3, etc.)
aws s3 cp env-backup.tar.gz.gpg s3://your-backup-bucket/
```

### Backup SigNoz Data

```bash
# Backup ClickHouse data
docker exec -it signoz-clickhouse clickhouse-client --query "BACKUP DATABASE signoz_logs TO Disk('backups', 'backup.zip')"
```

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  app:
    deploy:
      replicas: 3

  github-service:
    deploy:
      replicas: 2
```

### Load Balancer

Use nginx or cloud load balancer:

```nginx
upstream app_servers {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    location / {
        proxy_pass http://app_servers;
    }
}
```

## Troubleshooting

### Services not starting
```bash
# Check logs
pm2 logs
journalctl -u pm2-ubuntu -f

# Check ports
sudo netstat -tulpn | grep LISTEN

# Check processes
ps aux | grep node
```

### High memory usage
```bash
# Check memory
free -h
pm2 monit

# Restart service
pm2 restart ai-analyzer
```

### Disk space issues
```bash
# Check disk usage
df -h

# Clean logs
pm2 flush
docker system prune -a
```

## Security Checklist

- [ ] Environment variables secured
- [ ] Firewall configured (ufw/security groups)
- [ ] SSH key-based authentication only
- [ ] Regular security updates
- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] Secrets rotated regularly
- [ ] Monitoring and alerts set up

## Performance Optimization

1. **Enable caching** in GitHub Service
2. **Use PM2 cluster mode** for app
3. **Optimize SigNoz** retention policies
4. **Use GPT-3.5-turbo** instead of GPT-4
5. **Increase polling interval** to 10 minutes
6. **Add Redis** for caching

## Cost Estimation (Monthly)

### Infrastructure
- AWS EC2 t3.medium: ~$30
- Storage (100GB): ~$10
- Data transfer: ~$5

### APIs
- OpenAI (GPT-4, 288/day): ~$780
- OpenAI (GPT-3.5, 288/day): ~$17

**Recommended:** Use GPT-3.5-turbo for production to save ~$760/month!

## Support

For deployment issues:
1. Check service logs: `pm2 logs`
2. Verify ports: `netstat -tulpn`
3. Test connectivity: `curl http://localhost:PORT/health`
4. Review environment variables
5. Check disk space: `df -h`

## License

MIT
