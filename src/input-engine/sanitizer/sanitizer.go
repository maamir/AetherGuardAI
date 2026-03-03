package sanitizer

import (
	"context"
	"regexp"
	"strings"
	"unicode"
)

// Sanitizer removes hidden characters and exploit patterns from input
type Sanitizer struct {
	config Config
}

// Config holds sanitizer configuration
type Config struct {
	RemoveHiddenChars    bool
	RemoveControlChars   bool
	RemoveZeroWidth      bool
	NormalizeWhitespace  bool
	RemoveMarkdown       bool
	MaxLength            int
}

// SanitizationResult represents the result of sanitization
type SanitizationResult struct {
	SanitizedText    string
	OriginalText     string
	ModificationsCount int
	RemovedPatterns  []string
}

// NewSanitizer creates a new input sanitizer
func NewSanitizer(cfg Config) *Sanitizer {
	// Set defaults
	if cfg.MaxLength == 0 {
		cfg.MaxLength = 10000 // 10KB default
	}
	
	return &Sanitizer{
		config: cfg,
	}
}

// Sanitize cleans input text
func (s *Sanitizer) Sanitize(ctx context.Context, input string) (*SanitizationResult, error) {
	result := &SanitizationResult{
		SanitizedText:   input,
		OriginalText:    input,
		RemovedPatterns: []string{},
	}
	
	// 1. Enforce max length
	if len(input) > s.config.MaxLength {
		result.SanitizedText = input[:s.config.MaxLength]
		result.ModificationsCount++
		result.RemovedPatterns = append(result.RemovedPatterns, "truncated_to_max_length")
	}
	
	// 2. Remove hidden characters
	if s.config.RemoveHiddenChars {
		cleaned, removed := s.removeHiddenCharacters(result.SanitizedText)
		if removed {
			result.SanitizedText = cleaned
			result.ModificationsCount++
			result.RemovedPatterns = append(result.RemovedPatterns, "hidden_characters")
		}
	}
	
	// 3. Remove control characters
	if s.config.RemoveControlChars {
		cleaned, removed := s.removeControlCharacters(result.SanitizedText)
		if removed {
			result.SanitizedText = cleaned
			result.ModificationsCount++
			result.RemovedPatterns = append(result.RemovedPatterns, "control_characters")
		}
	}
	
	// 4. Remove zero-width characters
	if s.config.RemoveZeroWidth {
		cleaned, removed := s.removeZeroWidthCharacters(result.SanitizedText)
		if removed {
			result.SanitizedText = cleaned
			result.ModificationsCount++
			result.RemovedPatterns = append(result.RemovedPatterns, "zero_width_characters")
		}
	}
	
	// 5. Normalize whitespace
	if s.config.NormalizeWhitespace {
		cleaned, removed := s.normalizeWhitespace(result.SanitizedText)
		if removed {
			result.SanitizedText = cleaned
			result.ModificationsCount++
			result.RemovedPatterns = append(result.RemovedPatterns, "normalized_whitespace")
		}
	}
	
	// 6. Remove markdown exploits
	if s.config.RemoveMarkdown {
		cleaned, removed := s.removeMarkdownExploits(result.SanitizedText)
		if removed {
			result.SanitizedText = cleaned
			result.ModificationsCount++
			result.RemovedPatterns = append(result.RemovedPatterns, "markdown_exploits")
		}
	}
	
	return result, nil
}

// removeHiddenCharacters removes hidden Unicode characters
func (s *Sanitizer) removeHiddenCharacters(text string) (string, bool) {
	var result strings.Builder
	modified := false
	
	for _, r := range text {
		// Keep visible characters
		if unicode.IsPrint(r) || unicode.IsSpace(r) {
			result.WriteRune(r)
		} else {
			modified = true
		}
	}
	
	return result.String(), modified
}

// removeControlCharacters removes control characters (except newline, tab)
func (s *Sanitizer) removeControlCharacters(text string) (string, bool) {
	var result strings.Builder
	modified := false
	
	for _, r := range text {
		// Keep printable chars, newline, tab, carriage return
		if !unicode.IsControl(r) || r == '\n' || r == '\t' || r == '\r' {
			result.WriteRune(r)
		} else {
			modified = true
		}
	}
	
	return result.String(), modified
}

// removeZeroWidthCharacters removes zero-width Unicode characters
func (s *Sanitizer) removeZeroWidthCharacters(text string) (string, bool) {
	zeroWidthChars := []rune{
		'\u200B', // Zero Width Space
		'\u200C', // Zero Width Non-Joiner
		'\u200D', // Zero Width Joiner
		'\uFEFF', // Zero Width No-Break Space (BOM)
		'\u2060', // Word Joiner
	}
	
	result := text
	modified := false
	
	for _, char := range zeroWidthChars {
		if strings.ContainsRune(result, char) {
			result = strings.ReplaceAll(result, string(char), "")
			modified = true
		}
	}
	
	return result, modified
}

// normalizeWhitespace normalizes whitespace characters
func (s *Sanitizer) normalizeWhitespace(text string) (string, bool) {
	// Replace multiple spaces with single space
	re := regexp.MustCompile(`\s+`)
	normalized := re.ReplaceAllString(text, " ")
	
	// Trim leading/trailing whitespace
	normalized = strings.TrimSpace(normalized)
	
	return normalized, normalized != text
}

// removeMarkdownExploits removes potentially malicious markdown patterns
func (s *Sanitizer) removeMarkdownExploits(text string) (string, bool) {
	modified := false
	result := text
	
	// Remove markdown image syntax that could be used for tracking
	imgPattern := regexp.MustCompile(`!\[.*?\]\(.*?\)`)
	if imgPattern.MatchString(result) {
		result = imgPattern.ReplaceAllString(result, "[image removed]")
		modified = true
	}
	
	// Remove markdown link syntax with javascript: protocol
	jsLinkPattern := regexp.MustCompile(`\[.*?\]\(javascript:.*?\)`)
	if jsLinkPattern.MatchString(result) {
		result = jsLinkPattern.ReplaceAllString(result, "[malicious link removed]")
		modified = true
	}
	
	// Remove HTML comments that could hide content
	commentPattern := regexp.MustCompile(`<!--.*?-->`)
	if commentPattern.MatchString(result) {
		result = commentPattern.ReplaceAllString(result, "")
		modified = true
	}
	
	return result, modified
}

// GetStats returns sanitizer statistics
func (s *Sanitizer) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"remove_hidden_chars":   s.config.RemoveHiddenChars,
		"remove_control_chars":  s.config.RemoveControlChars,
		"remove_zero_width":     s.config.RemoveZeroWidth,
		"normalize_whitespace":  s.config.NormalizeWhitespace,
		"remove_markdown":       s.config.RemoveMarkdown,
		"max_length":            s.config.MaxLength,
	}
}
