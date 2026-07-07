# ---------- Build Stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (package.json + lock if exists)
COPY package.json ./
COPY package-lock.json* ./
RUN npm ci

# Copy source files
COPY . .

# Build the React/Vite app
RUN npm run build

# ---------- Production Stage ----------
FROM nginx:alpine-slim
# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf
# Copy custom nginx config (optional – basic static serve)
COPY nginx.conf /etc/nginx/conf.d
# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
