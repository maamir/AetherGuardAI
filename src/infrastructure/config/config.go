package config

import "time"

// Config holds all infrastructure configuration
type Config struct {
	Database DatabaseConfig `yaml:"database"`
	Cache    CacheConfig    `yaml:"cache"`
	EventBus EventBusConfig `yaml:"eventbus"`
	Monitoring MonitoringConfig `yaml:"monitoring"`
}

// DatabaseConfig holds database connection configuration
type DatabaseConfig struct {
	PostgreSQL PostgreSQLConfig `yaml:"postgresql"`
	TimescaleDB TimescaleDBConfig `yaml:"timescaledb"`
}

// PostgreSQLConfig holds PostgreSQL-specific configuration
type PostgreSQLConfig struct {
	Host            string        `yaml:"host"`
	Port            int           `yaml:"port"`
	Database        string        `yaml:"database"`
	User            string        `yaml:"user"`
	Password        string        `yaml:"password"`
	SSLMode         string        `yaml:"ssl_mode"`
	MinConnections  int           `yaml:"min_connections"`
	MaxConnections  int           `yaml:"max_connections"`
	ConnTimeout     time.Duration `yaml:"conn_timeout"`
	IdleTimeout     time.Duration `yaml:"idle_timeout"`
	HealthCheckInterval time.Duration `yaml:"health_check_interval"`
}

// TimescaleDBConfig holds TimescaleDB-specific configuration
type TimescaleDBConfig struct {
	Host            string        `yaml:"host"`
	Port            int           `yaml:"port"`
	Database        string        `yaml:"database"`
	User            string        `yaml:"user"`
	Password        string        `yaml:"password"`
	SSLMode         string        `yaml:"ssl_mode"`
	MinConnections  int           `yaml:"min_connections"`
	MaxConnections  int           `yaml:"max_connections"`
	ChunkInterval   string        `yaml:"chunk_interval"`
}

// CacheConfig holds Redis cache configuration
type CacheConfig struct {
	Addresses       []string      `yaml:"addresses"`
	Password        string        `yaml:"password"`
	DB              int           `yaml:"db"`
	PoolSize        int           `yaml:"pool_size"`
	MinIdleConns    int           `yaml:"min_idle_conns"`
	MaxRetries      int           `yaml:"max_retries"`
	DefaultTTL      time.Duration `yaml:"default_ttl"`
	ClusterMode     bool          `yaml:"cluster_mode"`
}

// EventBusConfig holds Kafka event bus configuration
type EventBusConfig struct {
	Brokers         []string      `yaml:"brokers"`
	GroupID         string        `yaml:"group_id"`
	ClientID        string        `yaml:"client_id"`
	ReplicationFactor int         `yaml:"replication_factor"`
	NumPartitions   int           `yaml:"num_partitions"`
	RetryAttempts   int           `yaml:"retry_attempts"`
	RetryBackoff    time.Duration `yaml:"retry_backoff"`
}

// MonitoringConfig holds monitoring configuration
type MonitoringConfig struct {
	MetricsPort     int    `yaml:"metrics_port"`
	HealthCheckPort int    `yaml:"health_check_port"`
	LogLevel        string `yaml:"log_level"`
}
