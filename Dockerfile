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

# Set environment
ENV NODE_ENV=production

# Single process: Express serves Next.js via custom server on process.env.PORT
CMD ["node", "server.js"]
