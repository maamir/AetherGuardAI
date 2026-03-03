package eventbus

import (
	"context"
	"fmt"
	"time"
	
	"github.com/segmentio/kafka-go"
	
	"github.com/aetherguard/aetherguard-ai/src/infrastructure/config"
)

// KafkaManager manages Kafka connections
type KafkaManager struct {
	config config.EventBusConfig
	writer *kafka.Writer
	readers map[string]*kafka.Reader
}

// NewKafkaManager creates a new Kafka connection manager
func NewKafkaManager(cfg config.EventBusConfig) (*KafkaManager, error) {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(cfg.Brokers...),
		Balancer:     &kafka.Hash{},
		RequiredAcks: kafka.RequireAll,
		Async:        false,
		Compression:  kafka.Snappy,
	}
	
	return &KafkaManager{
		config:  cfg,
		writer:  writer,
		readers: make(map[string]*kafka.Reader),
	}, nil
}

// Publish publishes a message to a Kafka topic
func (m *KafkaManager) Publish(ctx context.Context, topic string, key, value []byte) error {
	msg := kafka.Message{
		Topic: topic,
		Key:   key,
		Value: value,
		Time:  time.Now(),
	}
	
	// Retry logic with exponential backoff
	var err error
	for attempt := 0; attempt < m.config.RetryAttempts; attempt++ {
		err = m.writer.WriteMessages(ctx, msg)
		if err == nil {
			return nil
		}
		
		// Exponential backoff
		backoff := m.config.RetryBackoff * time.Duration(1<<uint(attempt))
		time.Sleep(backoff)
	}
	
	return fmt.Errorf("failed to publish message after %d attempts: %w", m.config.RetryAttempts, err)
}

// Subscribe creates a consumer for a topic
func (m *KafkaManager) Subscribe(topic string, groupID string) (*kafka.Reader, error) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:        m.config.Brokers,
		Topic:          topic,
		GroupID:        groupID,
		MinBytes:       10e3, // 10KB
		MaxBytes:       10e6, // 10MB
		CommitInterval: time.Second,
		StartOffset:    kafka.LastOffset,
	})
	
	m.readers[topic] = reader
	return reader, nil
}

// HealthCheck performs a health check on Kafka
func (m *KafkaManager) HealthCheck(ctx context.Context) error {
	conn, err := kafka.DialContext(ctx, "tcp", m.config.Brokers[0])
	if err != nil {
		return fmt.Errorf("failed to connect to Kafka: %w", err)
	}
	defer conn.Close()
	
	_, err = conn.Brokers()
	if err != nil {
		return fmt.Errorf("failed to get brokers: %w", err)
	}
	
	return nil
}

// Close closes all Kafka connections
func (m *KafkaManager) Close() error {
	if err := m.writer.Close(); err != nil {
		return err
	}
	
	for _, reader := range m.readers {
		if err := reader.Close(); err != nil {
			return err
		}
	}
	
	return nil
}
