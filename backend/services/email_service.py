import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(usecwd=True))

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


def send_customer_password_reset_email(
    to_email: str,
    store_name: str,
    reset_link: str,
    otp_code: str,
) -> bool:
    """
    Sends a password reset email to a customer with a 6-digit OTP code and direct reset link.
    """
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "noreply@webcreon.ai").strip()

    subject = f"{store_name} - Password Reset Verification Code"

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
          <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">{store_name}</h2>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Customer Security</p>
        </div>
        <div style="padding: 32px; color: #334155;">
          <h3 style="margin-top: 0; color: #0f172a;">Reset Your Password</h3>
          <p>We received a request to reset your password for your account at <strong>{store_name}</strong> (<strong>{to_email}</strong>).</p>
          
          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Your 6-Digit Reset Code</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb;">{otp_code}</div>
          </div>

          <p style="text-align: center; margin: 24px 0;">
            <a href="{reset_link}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
          </p>
          
          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">This code expires in <strong>15 minutes</strong>. If you did not request this, you can safely ignore this email.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          &copy; {store_name}. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    if not smtp_host or not smtp_user or not smtp_password:
        dev_box = f"""
================================================================================
 [CUSTOMER PASSWORD RESET - DEV FALLBACK]
 TO: {to_email}
 STORE: {store_name}
 RESET OTP CODE: {otp_code}
 RESET LINK: {reset_link}
================================================================================
"""
        print(dev_box)
        logger.info(f"Customer password reset code logged for {to_email}")
        return True

    try:
        print(f"[EMAIL] Connecting to SMTP server {smtp_host}:{smtp_port} for {to_email}...")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_from
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [to_email], msg.as_string())

        print(f"[EMAIL SUCCESS] Reset code {otp_code} successfully emailed to {to_email}")
        logger.info(f"Customer password reset email dispatched to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL FAILED] Could not send via SMTP ({e}). Fallback OTP is {otp_code}")
        logger.error(f"Failed to send customer password reset email to {to_email}: {e}")
        return False


def send_merchant_support_acknowledgment_email(
    to_email: str,
    to_name: str,
    ticket_number: str,
    subject: str,
    message_body: str,
) -> bool:
    """
    Sends a confirmation acknowledgment email for a newly created merchant support ticket.
    First checks dedicated SUPPORT_SMTP_* configuration.
    If not provided, falls back to the common platform SMTP_* configuration.
    If neither is configured, prints the dev fallback box.
    """
    # 1. Check dedicated Support SMTP first, fallback to common platform SMTP
    smtp_host = os.getenv("SUPPORT_SMTP_HOST", "").strip() or os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SUPPORT_SMTP_PORT", "").strip() or os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SUPPORT_SMTP_USER", "").strip() or os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SUPPORT_SMTP_PASSWORD", "").strip() or os.getenv("SMTP_PASSWORD", "").strip()
    smtp_from = (
        os.getenv("SUPPORT_SMTP_FROM", "").strip()
        or os.getenv("SMTP_FROM", "").strip()
        or (smtp_user or "support@webcreon.ai")
    )

    token_subject = f"[{ticket_number}] {subject}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Support Ticket Confirmation</title></head>
    <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
        <div style="background: #0f172a; padding: 24px 28px; border-bottom: 2px solid #2563eb;">
          <h2 style="color: #ffffff; margin: 0; font-size: 19px; font-weight: 700;">WebCreon Merchant Support</h2>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Ticket #{ticket_number}</p>
        </div>
        <div style="padding: 28px; color: #334155;">
          <p style="margin-top: 0; font-size: 15px; color: #0f172a;">Hi <strong>{to_name or 'there'}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.5; color: #475569;">We have received your support request regarding <strong>"{subject}"</strong>. Our support engineering team has been notified and is reviewing your inquiry.</p>
          
          <div style="background: #f1f5f9; border-radius: 8px; border-left: 4px solid #2563eb; padding: 14px 16px; margin: 20px 0;">
            <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Ticket Number</div>
            <div style="font-size: 16px; font-weight: 700; color: #0f172a;">#{ticket_number}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Estimated SLA Response: <strong>Within 2 hours</strong></div>
          </div>

          <div style="background: #fafafa; border: 1px solid #f1f5f9; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
            <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 6px;">Your Message:</div>
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #334155; white-space: pre-wrap;">{message_body}</p>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">You can reply directly to this email with any additional details or screenshots.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          &copy; WebCreon AI Autonomous Storefront Engine. All rights reserved.
        </div>
      </div>
    </body>
    </html>
    """

    if not smtp_host or not smtp_user or not smtp_password:
        dev_box = f"""
================================================================================
 [DEV FALLBACK SUPPORT EMAIL DISPATCHER]
 TO: {to_email} ({to_name})
 TICKET: #{ticket_number}
 SUBJECT: {token_subject}
 MESSAGE: {message_body[:200]}...
 (Configure SMTP_HOST/SMTP_USER/SMTP_PASSWORD or SUPPORT_SMTP_* in .env for live delivery)
================================================================================
"""
        print(dev_box)
        logger.info(f"Dev fallback support email logged for ticket #{ticket_number} to {to_email}")
        return True

    try:
        print(f"[EMAIL] Connecting to SMTP server {smtp_host}:{smtp_port} for {to_email} (Ticket #{ticket_number})...")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = token_subject
        msg["From"] = smtp_from
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_from, [to_email], msg.as_string())

        print(f"[EMAIL SUCCESS] Ticket acknowledgment #{ticket_number} successfully emailed to {to_email}")
        logger.info(f"Support ticket acknowledgment emailed to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL FAILED] Could not send support email via SMTP ({e})")
        logger.error(f"Failed to send support email to {to_email}: {e}")
        return False

