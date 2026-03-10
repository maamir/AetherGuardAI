FROM rust:1.85 as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy Cargo files
COPY Cargo.toml ./

# Create a dummy main.rs to build dependencies first
RUN mkdir -p src && echo "fn main() {}" > src/main.rs

# Update Cargo to latest version
RUN rustup update stable
RUN rustup default stable

# Build dependencies without lock file to avoid version conflicts
RUN cargo build --release

# Remove dummy files
RUN rm -rf src target

# Copy the actual source code
COPY src ./src

# Build the actual application
RUN cargo build --release

FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y ca-certificates curl libssl3 && \
    rm -rf /var/lib/apt/lists/*

# Copy the binary
COPY --from=builder /app/target/release/aetherguard-proxy /usr/local/bin/aetherguard-proxy

# Set permissions
RUN chmod +x /usr/local/bin/aetherguard-proxy

# Create non-root user
RUN groupadd -r aetherguard && useradd -r -g aetherguard aetherguard

USER aetherguard

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["aetherguard-proxy"]
