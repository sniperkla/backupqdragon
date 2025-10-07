# Fly.io Deployment Guide

## Setup
1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. Launch: `fly launch`

## Create Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4321
CMD ["npm", "start"]
```

## Deploy
- `fly launch` (creates fly.toml)
- `fly deploy`
- Set secrets: `fly secrets set MONGODB_URI="..."`

Fly.io is great for always-on services and supports your original server.js setup.