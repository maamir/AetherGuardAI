package database

import (
	"context"
	"fmt"
	"time"
	
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	
	"github.com/aetherguard/aetherguard-ai/src/infrastructure/config"
)

// PostgreSQLManager manages PostgreSQL connections
type PostgreSQLManager struct {
	db     *gorm.DB
	config config.PostgreSQLConfig
}

// NewPostgreSQLManager creates a new PostgreSQL connection manager
func NewPostgreSQLManager(cfg config.PostgreSQLConfig) (*PostgreSQLManager, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Database, cfg.SSLMode,
	)
	
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}
	
	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}
	
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}
	
	// Configure connection pool
	sqlDB.SetMaxOpenConns(cfg.MaxConnections)
	sqlDB.SetMaxIdleConns(cfg.MinConnections)
	sqlDB.SetConnMaxLifetime(cfg.IdleTimeout)
	sqlDB.SetConnMaxIdleTime(cfg.IdleTimeout)
	
	return &PostgreSQLManager{
		db:     db,
		config: cfg,
	}, nil
}

// DB returns the GORM database instance
func (m *PostgreSQLManager) DB() *gorm.DB {
	return m.db
}

// HealthCheck performs a health check on the database
func (m *PostgreSQLManager) HealthCheck(ctx context.Context) error {
	sqlDB, err := m.db.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}
	
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	
	if err := sqlDB.PingContext(ctx); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}
	
	return nil
}

// Close closes the database connection
func (m *PostgreSQLManager) Close() error {
	sqlDB, err := m.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// WithTenant returns a database instance scoped to a tenant schema
func (m *PostgreSQLManager) WithTenant(tenantSchema string) *gorm.DB {
	return m.db.Exec(fmt.Sprintf("SET search_path TO %s", tenantSchema))
}
