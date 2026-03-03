# Multi-stage build for AetherGuard AI Infrastructure
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY src/ ./src/

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /aetherguard-infrastructure ./src/infrastructure

# Final stage
FROM alpine:3.18

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Create non-root user
RUN addgroup -g 1000 aetherguard && \
    adduser -D -u 1000 -G aetherguard aetherguard

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /aetherguard-infrastructure .
COPY config/ ./config/

# Change ownership
RUN chown -R aetherguard:aetherguard /app

# Switch to non-root user
USER aetherguard

# Expose ports
EXPOSE 8080 9090

# Run the application
CMD ["./aetherguard-infrastructure"]
