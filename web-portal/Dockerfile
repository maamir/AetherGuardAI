# Development Dockerfile - serves with Vite dev server
FROM node:18-alpine

WORKDIR /app

# Install system dependencies including curl for health checks
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./

# Clean install and configure npm to avoid module issues
RUN rm -rf node_modules package-lock.json
RUN npm cache clean --force

# Configure npm for better compatibility
RUN npm config set fund false
RUN npm config set audit false
RUN npm config set legacy-peer-deps true

# Install dependencies with specific flags to avoid rollup and ES module issues
RUN npm install --force

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Set environment variables to handle ES modules and Vite properly
ENV NODE_ENV=development

# Health check using curl instead of wget
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# Start development server with proper module handling
CMD ["npm", "run", "dev"]