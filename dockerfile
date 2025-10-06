# -----------------------------
# Uber Route Optimization Dockerfile
# -----------------------------

# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies (Add some new feature)
COPY package*.json ./
RUN npm install --only=production

# Copy application files
COPY . .

# Stage 2: Final runtime
FROM node:20-alpine
WORKDIR /app

# Copy from builder
COPY --from=builder /app /app

# Expose the app port
EXPOSE 3000

# Default environment (can be overridden)
ENV NODE_ENV=production

# Run the application
CMD ["node", "routeOptimizer.js"]
