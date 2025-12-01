FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
# First, install all dependencies to generate package-lock.json
RUN npm install

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
