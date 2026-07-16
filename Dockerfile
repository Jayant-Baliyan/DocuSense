FROM node:20-alpine

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies (development & production) to ensure build capabilities
RUN npm install

# Copy application files
COPY . .

# Build the Next.js production build
RUN npm run build

# Expose ports (Next.js default)
EXPOSE 3000

# Set environment
ENV PORT=3000
ENV BACKEND_PORT=3001
ENV NODE_ENV=production

# Start both next and express server concurrently
CMD ["npx", "concurrently", "\"node server.js\"", "\"npx next start -p 3000\""]
