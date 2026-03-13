FROM rust:1.75 as builder

WORKDIR /app

# Install build dependencies for AWS SDK and cryptography
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy Cargo files
COPY Cargo.toml ./

# Create a dummy main.rs to build dependencies first
RUN mkdir -p src && echo "fn main() {}" > src/main.rs

# Update Rust toolchain
RUN rustup update stable
RUN rustup default stable

# Build dependencies (this will include all AWS SDK and crypto dependencies)
RUN cargo build --release --features aws-production

# Remove dummy files
RUN rm -rf src target/release/deps/aetherguard*

# Copy the actual source code
COPY src ./src

# Build the actual application with production features
RUN cargo build --release --features aws-production

FROM debian:bookworm-slim

# Install runtime dependencies for AWS SDK and TLS
RUN apt-get update && \
    apt-get install -y \
    ca-certificates \
    curl \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

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
    CMD curl -f http://127.0.0.1:8080/health || exit 1

CMD ["aetherguard-proxy"]
