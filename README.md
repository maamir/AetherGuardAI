# AetherGuard AI - Infrastructure & Data Access

Enterprise-grade, real-time bi-directional firewall for Large Language Models (LLMs).

## Project Structure

```
aetherguard-ai/
├── src/
│   └── infrastructure/          # Unit 1: Infrastructure & Data Access
│       ├── config/              # Configuration management
│       ├── database/            # PostgreSQL, TimescaleDB, Redis managers
│       ├── eventbus/            # Apache Kafka event streaming
│       ├── cache/               # Redis caching
│       └── models/              # Domain models
├── tests/
│   └── infrastructure/          # Unit tests and integration tests
├── config/                      # Environment configurations
├── scripts/                     # Utility scripts and migrations
├── deployments/                 # Kubernetes and Terraform files
├── go.mod                       # Go module definition
├── Dockerfile                   # Container image definition
└── README.md                    # This file
```

## Technology Stack

- **Language**: Go 1.21+
- **Databases**: PostgreSQL 16, TimescaleDB 2.x
- **Cache**: Redis Cluster 7+
- **Event Bus**: Apache Kafka 3.x
- **ORM**: GORM 1.25+
- **Container**: Docker + Kubernetes
- **IaC**: Terraform

## Getting Started

### Prerequisites

- Go 1.21 or higher
- Docker and Docker Compose
- PostgreSQL 16
- Redis 7+
- Apache Kafka 3.x

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/aetherguard/aetherguard-ai.git
   cd aetherguard-ai
   ```

2. **Install dependencies**
   ```bash
   go mod download
   ```

3. **Start infrastructure services**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations**
   ```bash
   go run scripts/migrate.go
   ```

5. **Run the application**
   ```bash
   go run src/infrastructure/main.go
   ```

### Running Tests

```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run integration tests
go test -tags=integration ./tests/infrastructure/...
```

## Configuration

Configuration is managed through YAML files in the `config/` directory:

- `development.yaml` - Local development
- `staging.yaml` - Staging environment
- `production.yaml` - Production environment

Environment variables override YAML configuration:
- `POSTGRES_HOST`, `POSTGRES_PASSWORD`
- `TIMESCALE_HOST`, `TIMESCALE_PASSWORD`
- `REDIS_PASSWORD`

## Architecture

### Components

**Data Access Component**: Provides unified interface for PostgreSQL, TimescaleDB, and Redis operations with connection pooling, transaction management (2PC), and query caching.

**Event Bus Component**: Apache Kafka-based event streaming with CloudEvents 1.0 compliance, at-least-once delivery, retry logic, and dead-letter queue.

**Cache Component**: Redis Cluster caching with event-driven invalidation, fail-open pattern, and tenant-aware key management.

### Multi-Tenancy

- Per-tenant database schemas (10-50 tenants supported)
- Shared connection pool with tenant context
- Tenant isolation enforced at query level

### Performance Targets

- Database operations: < 20ms (95th percentile)
- Event publishing: < 10ms (95th percentile)
- Cache operations: < 2ms (95th percentile)
- Throughput: 1,000-10,000 req/sec

## Deployment

### Docker

```bash
# Build image
docker build -t aetherguard-infrastructure:latest .

# Run container
docker run -p 8080:8080 -p 9090:9090 aetherguard-infrastructure:latest
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f deployments/kubernetes/

# Check status
kubectl get pods -n aetherguard
```

### Terraform

```bash
# Initialize Terraform
cd deployments/terraform
terraform init

# Plan infrastructure
terraform plan

# Apply infrastructure
terraform apply
```

## Monitoring

- **Metrics**: Prometheus metrics exposed on port 9090
- **Health Checks**: Health endpoint on port 8080/health
- **Dashboards**: Grafana dashboards in `deployments/grafana/`

## Documentation

- [API Documentation](aidlc-docs/construction/unit-1-infrastructure/code/api-documentation.md)
- [Deployment Guide](aidlc-docs/construction/unit-1-infrastructure/code/deployment-guide.md)
- [Operational Runbooks](aidlc-docs/construction/unit-1-infrastructure/code/runbooks.md)

## License

Copyright © 2026 AetherGuard AI. All rights reserved.
