FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app (frontend + server)
RUN npm run build

# Expose port
EXPOSE 3000

# Start the Express server
CMD ["npm", "run", "start"]
