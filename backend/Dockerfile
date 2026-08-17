FROM node:20-alpine

WORKDIR /app

# Copy manifests first for better Docker layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy source code
COPY . .

EXPOSE 8000

# Use the production start script (not dev/watch)
CMD ["npm", "run", "start"]
