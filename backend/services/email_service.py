import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@webcreon.ai").strip()


def send_admin_password_reset_email(to_email: str, reset_link: str, otp_code: str) -> bool:
    """
    Sends a password reset email to the admin with a link and OTP code.
    If SMTP server credentials are missing, falls back to logging a clear box in dev output.
    """
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "noreply@webcreon.ai").strip()

    subject = "WebCreon AI Admin - Password Reset Request"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Password Reset Request</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: #0f172a; padding: 24px; text-align: center; border-bottom: 2px solid #2563eb;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">WebCreon AI</h2>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Admin Security Portal</p>
        </div>
        <div style="padding: 32px; color: #334155;">
          <h3 style="margin-top: 0; color: #0f172a;">Password Reset Request</h3>
          <p>We received a request to reset your password for your WebCreon AI Admin account (<strong>{to_email}</strong>).</p>
          
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Your 6-Digit Reset Code</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb;">{otp_code}</div>
          </div>

          <p style="text-align: center; margin: 24px 0;">
            <a href="{reset_link}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password Now</a>
          </p>
          
          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">This link and code will expire in <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          &copy; WebCreon AI E-Commerce Platform. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    if not smtp_host or not smtp_user or not smtp_password:
        # Fallback to dev output log
        dev_box = f"""
================================================================================
 [DEV FALLBACK EMAIL DISPATCHER]
 TO: {to_email}
 SUBJECT: {subject}
 RESET OTP CODE: {otp_code}
 RESET LINK: {reset_link}
 (Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env for live email delivery)
================================================================================
"""
        print(dev_box)
        logger.info(f"Password reset token logged for {to_email}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_from
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [to_email], msg.as_string())

        logger.info(f"Password reset email dispatched to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email to {to_email}: {e}")
        return False
