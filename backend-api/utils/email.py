"""
Email service for sending notifications
Supports SMTP configuration via environment variables
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """Handle email sending via SMTP"""
    
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "localhost")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from = os.getenv("SMTP_FROM", "noreply@aetherguard.ai")
        self.smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        
        self.enabled = bool(self.smtp_host and self.smtp_user)
        
        if not self.enabled:
            logger.warning("Email service not configured. Set SMTP_* environment variables.")
    
    def send_email(
        self,
        to: List[str],
        subject: str,
        body_text: str,
        body_html: Optional[str] = None
    ) -> bool:
        """
        Send email via SMTP
        
        Args:
            to: List of recipient email addresses
            subject: Email subject
            body_text: Plain text body
            body_html: Optional HTML body
        
        Returns:
            bool: True if sent successfully
        """
        if not self.enabled:
            logger.warning(f"Email not sent (service disabled): {subject}")
            return False
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.smtp_from
            msg['To'] = ', '.join(to)
            
            # Add text part
            text_part = MIMEText(body_text, 'plain')
            msg.attach(text_part)
            
            # Add HTML part if provided
            if body_html:
                html_part = MIMEText(body_html, 'html')
                msg.attach(html_part)
            
            # Connect and send
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.smtp_use_tls:
                    server.starttls()
                
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to}: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    def send_welcome_email(self, to: str, name: str) -> bool:
        """Send welcome email to new user"""
        subject = "Welcome to AetherGuard AI"
        
        body_text = f"""
Hello {name},

Welcome to AetherGuard AI! Your account has been created successfully.

You can now:
- Create API keys
- Configure LLM providers
- Set up security policies
- Monitor your usage

Get started at: https://portal.aetherguard.ai

Best regards,
The AetherGuard Team
"""
        
        body_html = f"""
<html>
<body>
<h2>Welcome to AetherGuard AI</h2>
<p>Hello {name},</p>
<p>Welcome to AetherGuard AI! Your account has been created successfully.</p>
<p>You can now:</p>
<ul>
<li>Create API keys</li>
<li>Configure LLM providers</li>
<li>Set up security policies</li>
<li>Monitor your usage</li>
</ul>
<p><a href="https://portal.aetherguard.ai">Get started</a></p>
<p>Best regards,<br>The AetherGuard Team</p>
</body>
</html>
"""
        
        return self.send_email([to], subject, body_text, body_html)
    
    def send_password_reset_email(self, to: str, reset_token: str) -> bool:
        """Send password reset email"""
        reset_url = f"https://portal.aetherguard.ai/reset-password?token={reset_token}"
        
        subject = "Reset Your AetherGuard Password"
        
        body_text = f"""
Hello,

You requested to reset your AetherGuard password.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
The AetherGuard Team
"""
        
        body_html = f"""
<html>
<body>
<h2>Reset Your Password</h2>
<p>Hello,</p>
<p>You requested to reset your AetherGuard password.</p>
<p><a href="{reset_url}">Click here to reset your password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request this, please ignore this email.</p>
<p>Best regards,<br>The AetherGuard Team</p>
</body>
</html>
"""
        
        return self.send_email([to], subject, body_text, body_html)
    
    def send_api_key_created_email(self, to: str, key_name: str) -> bool:
        """Send notification when API key is created"""
        subject = "New API Key Created"
        
        body_text = f"""
Hello,

A new API key has been created in your AetherGuard account:

Key Name: {key_name}
Created: Just now

If you didn't create this key, please contact support immediately.

Best regards,
The AetherGuard Team
"""
        
        body_html = f"""
<html>
<body>
<h2>New API Key Created</h2>
<p>Hello,</p>
<p>A new API key has been created in your AetherGuard account:</p>
<ul>
<li><strong>Key Name:</strong> {key_name}</li>
<li><strong>Created:</strong> Just now</li>
</ul>
<p>If you didn't create this key, please contact support immediately.</p>
<p>Best regards,<br>The AetherGuard Team</p>
</body>
</html>
"""
        
        return self.send_email([to], subject, body_text, body_html)


# Global instance
_email_service = None

def get_email_service() -> EmailService:
    """Get or create global email service instance"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
