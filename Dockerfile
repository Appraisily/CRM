# Dockerfile

# Use Node.js LTS
FROM node:18-slim

# Create and set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Expose port
EXPOSE 8080

# Set environment variable
ENV PORT=8080

# Start the application
CMD [ "npm", "start" ]
