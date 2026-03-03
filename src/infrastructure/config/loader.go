package config

import (
	"fmt"
	"os"
	"gopkg.in/yaml.v3"
)

// Load reads configuration from a YAML file
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	// Apply environment variable overrides
	applyEnvOverrides(&cfg)

	return &cfg, nil
}

// applyEnvOverrides applies environment variable overrides to configuration
func applyEnvOverrides(cfg *Config) {
	if host := os.Getenv("POSTGRES_HOST"); host != "" {
		cfg.Database.PostgreSQL.Host = host
	}
	if pass := os.Getenv("POSTGRES_PASSWORD"); pass != "" {
		cfg.Database.PostgreSQL.Password = pass
	}
	if host := os.Getenv("TIMESCALE_HOST"); host != "" {
		cfg.Database.TimescaleDB.Host = host
	}
	if pass := os.Getenv("TIMESCALE_PASSWORD"); pass != "" {
		cfg.Database.TimescaleDB.Password = pass
	}
	if pass := os.Getenv("REDIS_PASSWORD"); pass != "" {
		cfg.Cache.Password = pass
	}
}
