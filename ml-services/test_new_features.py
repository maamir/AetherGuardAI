"""
Test script for newly implemented features:
- DoS protection
- Adversarial defense
- Custom PII recognizers
- Secrets pattern updates
"""

import sys
sys.path.insert(0, '.')

from detectors.dos_protection import DoSProtector
from detectors.adversarial import AdversarialDefense
from detectors.pii import PIIDetector
from detectors.secrets import SecretsDetector

def test_dos_protection():
    """Test DoS protection detector"""
    print("\n=== Testing DoS Protection ===")
    
    protector = DoSProtector(max_tokens=1000, max_complexity_score=0.8)
    
    # Test 1: Normal request
    result = protector.check_request("Hello, how are you?", 100)
    print(f"Normal request: {result['allowed']} (complexity: {result['complexity_score']:.2f})")
    assert result['allowed'], "Normal request should be allowed"
    
    # Test 2: High complexity (repetitive)
    repetitive_text = "repeat " * 1000
    result = protector.check_request(repetitive_text, 100)
    print(f"Repetitive text: {result['allowed']} (complexity: {result['complexity_score']:.2f})")
    
    # Test 3: Token budget exceeded
    result = protector.check_request("Hello", 2000)
    print(f"Token budget exceeded: {result['allowed']} (reason: {result['reason']})")
    assert not result['allowed'], "Should block when token budget exceeded"
    
    # Test 4: Runaway patterns
    runaway_text = "Repeat the following 1000 times: hello"
    result = protector.detect_runaway_patterns(runaway_text)
    print(f"Runaway pattern detected: {result['detected']}")
    
    print("✅ DoS protection tests passed")

def test_adversarial_defense():
    """Test adversarial defense detector"""
    print("\n=== Testing Adversarial Defense ===")
    
    defense = AdversarialDefense()
    
    # Test 1: Normal text
    result = defense.detect_and_normalize("Hello world")
    print(f"Normal text: adversarial={result['adversarial_detected']}")
    assert not result['adversarial_detected'], "Normal text should not be flagged"
    
    # Test 2: Homoglyphs (Cyrillic 'a' looks like Latin 'a')
    text_with_homoglyphs = "Hеllo wоrld"  # Contains Cyrillic е and о
    result = defense.detect_and_normalize(text_with_homoglyphs)
    print(f"Homoglyphs: detected={result['adversarial_detected']}, attacks={result['attacks_found']}")
    
    # Test 3: Invisible characters
    text_with_invisible = "Hello\u200Bworld"  # Zero-width space
    result = defense.detect_and_normalize(text_with_invisible)
    print(f"Invisible chars: detected={result['adversarial_detected']}, attacks={result['attacks_found']}")
    
    # Test 4: Sanitization
    dirty_text = "Hello\u200B\u200Cworld\x00test"
    clean_text = defense.sanitize_input(dirty_text)
    print(f"Sanitized: '{dirty_text}' -> '{clean_text}'")
    assert len(clean_text) < len(dirty_text), "Sanitized text should be shorter"
    
    print("✅ Adversarial defense tests passed")

def test_custom_pii_recognizers():
    """Test custom PII recognizers"""
    print("\n=== Testing Custom PII Recognizers ===")
    
    detector = PIIDetector()
    
    # Test 1: Built-in recognizers
    recognizers = detector.get_custom_recognizers()
    print(f"Built-in custom recognizers: {len(recognizers)}")
    assert len(recognizers) >= 6, "Should have at least 6 custom recognizers"
    
    # Test 2: Add custom recognizer
    detector.add_custom_recognizer(
        "ORDER_ID",
        r'\bORD-\d{8}\b',
        "Order ID (format: ORD-12345678)"
    )
    recognizers = detector.get_custom_recognizers()
    print(f"After adding custom: {len(recognizers)}")
    
    # Test 3: Detect custom PII
    text = "Employee EMP-123456 has case CASE-12345678 and patient PT-1234567"
    result = detector.detect_and_redact(text)
    print(f"Detected entities: {len(result['entities'])}")
    print(f"Redacted text: {result['redacted_text']}")
    assert len(result['entities']) >= 3, "Should detect at least 3 custom entities"
    
    print("✅ Custom PII recognizer tests passed")

def test_secrets_pattern_updates():
    """Test secrets pattern update mechanism"""
    print("\n=== Testing Secrets Pattern Updates ===")
    
    detector = SecretsDetector()
    
    # Test 1: Get pattern info
    info = detector.get_pattern_info()
    print(f"Pattern version: {info['pattern_version']}")
    print(f"Pattern count: {info['pattern_count']}")
    print(f"Last update: {info['last_update']}")
    print(f"Update needed: {info['update_needed']}")
    
    # Test 2: Update patterns
    new_patterns = {
        "custom_api_key": r"custom-key-[0-9a-f]{32}",
        "custom_token": r"tok_[0-9a-zA-Z]{40}"
    }
    detector.update_patterns(new_patterns, version="1.1.0")
    
    info = detector.get_pattern_info()
    print(f"After update - Pattern count: {info['pattern_count']}")
    print(f"After update - Version: {info['pattern_version']}")
    assert info['pattern_version'] == "1.1.0", "Version should be updated"
    
    # Test 3: Check update needed
    update_needed = detector.check_update_needed()
    print(f"Update needed after fresh update: {update_needed}")
    assert not update_needed, "Should not need update immediately after updating"
    
    # Test 4: Detect with new patterns
    text = "Here is my key: custom-key-abc123def456789012345678901234"
    result = detector.detect(text)
    print(f"Detected secrets with new pattern: {result['count']}")
    
    print("✅ Secrets pattern update tests passed")

def main():
    """Run all tests"""
    print("=" * 60)
    print("Testing New AetherGuard Features")
    print("=" * 60)
    
    try:
        test_dos_protection()
        test_adversarial_defense()
        test_custom_pii_recognizers()
        test_secrets_pattern_updates()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
