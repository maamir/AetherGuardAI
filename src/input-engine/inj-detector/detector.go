package inj_detector

import (
	"context"
	"fmt"
	"regexp"
	"strings"
)

// INJDetector detects injection attacks (SQL, Command, Code)
type INJDetector struct {
	sqlDetector  *SQLDetector
	cmdDetector  *CommandDetector
	codeDetector *CodeDetector
}

// DetectionResult represents the result of injection detection
type DetectionResult struct {
	IsInjection  bool
	InjectionType string
	Confidence   float64
	Reason       string
	Patterns     []string
}

// NewINJDetector creates a new injection detector
func NewINJDetector() *INJDetector {
	return &INJDetector{
		sqlDetector:  NewSQLDetector(),
		cmdDetector:  NewCommandDetector(),
		codeDetector: NewCodeDetector(),
	}
}

// Detect analyzes input for injection attacks
func (d *INJDetector) Detect(ctx context.Context, input string) (*DetectionResult, error) {
	// Check SQL injection
	if sqlResult := d.sqlDetector.Detect(input); sqlResult.IsInjection {
		return sqlResult, nil
	}
	
	// Check command injection
	if cmdResult := d.cmdDetector.Detect(input); cmdResult.IsInjection {
		return cmdResult, nil
	}
	
	// Check code injection
	if codeResult := d.codeDetector.Detect(input); codeResult.IsInjection {
		return codeResult, nil
	}
	
	return &DetectionResult{
		IsInjection: false,
		Confidence:  0.0,
	}, nil
}

// SQLDetector detects SQL injection attempts
type SQLDetector struct {
	patterns []DetectionPattern
}

// DetectionPattern represents a detection pattern
type DetectionPattern struct {
	Name        string
	Pattern     *regexp.Regexp
	Description string
}

// NewSQLDetector creates a new SQL injection detector
func NewSQLDetector() *SQLDetector {
	return &SQLDetector{
		patterns: []DetectionPattern{
			{
				Name:        "sql_union",
				Pattern:     regexp.MustCompile(`(?i)\bunion\s+(all\s+)?select\b`),
				Description: "SQL UNION injection",
			},
			{
				Name:        "sql_comment",
				Pattern:     regexp.MustCompile(`(--|#|/\*|\*/)`),
				Description: "SQL comment injection",
			},
			{
				Name:        "sql_or_condition",
				Pattern:     regexp.MustCompile(`(?i)(\bor\b|\|\|)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?`),
				Description: "SQL OR condition (e.g., OR 1=1)",
			},
			{
				Name:        "sql_drop_table",
				Pattern:     regexp.MustCompile(`(?i)\bdrop\s+(table|database)\b`),
				Description: "SQL DROP statement",
			},
			{
				Name:        "sql_exec",
				Pattern:     regexp.MustCompile(`(?i)\b(exec|execute|sp_executesql)\b`),
				Description: "SQL EXEC statement",
			},
			{
				Name:        "sql_information_schema",
				Pattern:     regexp.MustCompile(`(?i)\binformation_schema\b`),
				Description: "SQL information_schema access",
			},
		},
	}
}

// Detect checks for SQL injection
func (d *SQLDetector) Detect(input string) *DetectionResult {
	result := &DetectionResult{
		IsInjection:   false,
		InjectionType: "sql",
		Confidence:    0.0,
		Patterns:      []string{},
	}
	
	for _, pattern := range d.patterns {
		if pattern.Pattern.MatchString(input) {
			result.IsInjection = true
			result.Confidence = 0.9
			result.Reason = pattern.Description
			result.Patterns = append(result.Patterns, pattern.Name)
		}
	}
	
	return result
}

// CommandDetector detects command injection attempts
type CommandDetector struct {
	patterns []DetectionPattern
}

// NewCommandDetector creates a new command injection detector
func NewCommandDetector() *CommandDetector {
	return &CommandDetector{
		patterns: []DetectionPattern{
			{
				Name:        "cmd_pipe",
				Pattern:     regexp.MustCompile(`[|;&]\s*(ls|cat|wget|curl|nc|bash|sh|python|perl|ruby)`),
				Description: "Command chaining with pipe/semicolon",
			},
			{
				Name:        "cmd_backtick",
				Pattern:     regexp.MustCompile("`[^`]+`"),
				Description: "Backtick command substitution",
			},
			{
				Name:        "cmd_substitution",
				Pattern:     regexp.MustCompile(`\$\([^)]+\)`),
				Description: "Command substitution $()",
			},
			{
				Name:        "cmd_redirect",
				Pattern:     regexp.MustCompile(`[<>]+\s*/\w+`),
				Description: "File redirection",
			},
			{
				Name:        "cmd_dangerous",
				Pattern:     regexp.MustCompile(`(?i)\b(rm\s+-rf|mkfs|dd\s+if=|format\s+c:)\b`),
				Description: "Dangerous system commands",
			},
		},
	}
}

// Detect checks for command injection
func (d *CommandDetector) Detect(input string) *DetectionResult {
	result := &DetectionResult{
		IsInjection:   false,
		InjectionType: "command",
		Confidence:    0.0,
		Patterns:      []string{},
	}
	
	for _, pattern := range d.patterns {
		if pattern.Pattern.MatchString(input) {
			result.IsInjection = true
			result.Confidence = 0.9
			result.Reason = pattern.Description
			result.Patterns = append(result.Patterns, pattern.Name)
		}
	}
	
	return result
}

// CodeDetector detects code injection attempts
type CodeDetector struct {
	patterns []DetectionPattern
}

// NewCodeDetector creates a new code injection detector
func NewCodeDetector() *CodeDetector {
	return &CodeDetector{
		patterns: []DetectionPattern{
			{
				Name:        "code_eval",
				Pattern:     regexp.MustCompile(`(?i)\b(eval|exec|compile|__import__)\s*\(`),
				Description: "Code evaluation functions",
			},
			{
				Name:        "code_script_tag",
				Pattern:     regexp.MustCompile(`(?i)<script[^>]*>.*?</script>`),
				Description: "Script tag injection",
			},
			{
				Name:        "code_javascript",
				Pattern:     regexp.MustCompile(`(?i)javascript:\s*`),
				Description: "JavaScript protocol injection",
			},
			{
				Name:        "code_php",
				Pattern:     regexp.MustCompile(`<\?php`),
				Description: "PHP code injection",
			},
			{
				Name:        "code_template",
				Pattern:     regexp.MustCompile(`\{\{.*?\}\}|\{%.*?%\}`),
				Description: "Template injection",
			},
		},
	}
}

// Detect checks for code injection
func (d *CodeDetector) Detect(input string) *DetectionResult {
	result := &DetectionResult{
		IsInjection:   false,
		InjectionType: "code",
		Confidence:    0.0,
		Patterns:      []string{},
	}
	
	for _, pattern := range d.patterns {
		if pattern.Pattern.MatchString(input) {
			result.IsInjection = true
			result.Confidence = 0.9
			result.Reason = pattern.Description
			result.Patterns = append(result.Patterns, pattern.Name)
		}
	}
	
	return result
}

// GetStats returns detection statistics
func (d *INJDetector) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"sql_patterns":  len(d.sqlDetector.patterns),
		"cmd_patterns":  len(d.cmdDetector.patterns),
		"code_patterns": len(d.codeDetector.patterns),
	}
}
