# Use a Node.js base image with Chromium pre-installed for Remotion
FROM ghcr.io/remotion-dev/template-blank:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the frontend
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the server
# We use tsx to run the server.ts file directly
CMD ["npx", "tsx", "server.ts"]
