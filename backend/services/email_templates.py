"""
Centralized Responsive HTML Transactional Email Templates for WebCreon Platform.
Renders modern, mobile-responsive, beautifully formatted emails with store branding,
itemized receipt tables, adaptive action links, and multi-client dark/light mode support.
"""

from typing import Any, Dict, List, Optional
import re


def clean_store_display_name(raw_name: Optional[str]) -> str:
    """Cleans up raw slug/timestamp store names into crisp display titles."""
    if not raw_name:
        return "Store"
    clean = raw_name.strip()
    # Remove trailing timestamp/ID suffixes like greenharvest-1786392567758
    clean = re.sub(r"[-_]\d{6,}$", "", clean)
    if clean.islower() or "-" in clean or "_" in clean:
        clean = clean.replace("-", " ").replace("_", " ").title()
    return clean


def _base_email_layout(
    store_name: str,
    body_content: str,
    preview_text: str = "",
    accent_color: str = "#2563eb",
    footer_text: Optional[str] = None,
    action_url: Optional[str] = None,
    action_label: Optional[str] = None,
    badge_label: Optional[str] = None,
    badge_color: str = "#10b981",
) -> str:
    display_store = clean_store_display_name(store_name)
    footer = footer_text or f"© {display_store}. All rights reserved."

    badge_html = ""
    if badge_label:
        badge_html = f"""
        <div style="margin-bottom: 16px;">
          <span style="display: inline-block; background-color: #f0fdf4; color: {badge_color}; border: 1px solid #bbf7d0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 20px;">
            {badge_label}
          </span>
        </div>
        """

    cta_button_html = ""
    if action_url and action_label:
        cta_button_html = f"""
        <div style="text-align: center; margin: 28px 0 16px 0;">
          <a href="{action_url}" target="_blank" style="display: inline-block; background-color: {accent_color}; color: #ffffff !important; font-size: 14px; font-weight: 700; text-decoration: none; padding: 13px 32px; border-radius: 8px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25); text-align: center;">
            {action_label} &rarr;
          </a>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{display_store}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
    table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
    img {{ -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }}
    body {{
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }}
    .email-container {{
      max-width: 580px;
      margin: 32px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }}
    .brand-header {{
      background: #ffffff;
      padding: 24px 32px 18px 32px;
      border-bottom: 1px solid #f1f5f9;
      text-align: left;
    }}
    .brand-title {{
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin: 0;
      display: inline-block;
    }}
    .brand-bar {{
      height: 3px;
      background: linear-gradient(90deg, {accent_color} 0%, #38bdf8 100%);
      width: 100%;
    }}
    .email-content {{
      padding: 28px 32px;
      background-color: #ffffff;
    }}
    .receipt-card {{
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 18px;
      margin: 20px 0;
    }}
    .receipt-table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }}
    .receipt-table th {{
      text-align: left;
      padding: 8px 0;
      color: #64748b;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #cbd5e1;
    }}
    .receipt-table td {{
      padding: 10px 0;
      color: #334155;
      border-bottom: 1px solid #e2e8f0;
    }}
    .badge-box {{
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      margin: 20px 0;
    }}
    .badge-code {{
      font-size: 28px;
      font-weight: 800;
      color: {accent_color};
      letter-spacing: 4px;
      font-family: monospace;
      margin: 4px 0 0 0;
    }}
    .email-footer {{
      background-color: #f8fafc;
      padding: 20px 32px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }}
    @media only screen and (max-width: 600px) {{
      .email-container {{ margin: 12px !important; width: auto !important; }}
      .brand-header, .email-content, .email-footer {{ padding: 20px 18px !important; }}
    }}
  </style>
</head>
<body>
  <!-- Preheader text -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
    {preview_text}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding: 16px 8px;">
        <div class="email-container">
          <div class="brand-bar"></div>
          
          <!-- Store Header -->
          <div class="brand-header">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="left">
                  <div class="brand-title">{display_store}</div>
                </td>
                <td align="right">
                  <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; background: #f1f5f9; padding: 3px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
                    Verified Store
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Main Email Content -->
          <div class="email-content">
            {badge_html}
            {body_content}
            {cta_button_html}
          </div>

          <!-- Store Footer -->
          <div class="email-footer">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">{display_store}</p>
            <p style="margin: 0 0 8px 0;">{footer}</p>
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">
              This is an automated transactional update for your account.
            </p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def render_email_template(template_key: str, vars_dict: Dict[str, Any]) -> tuple[str, str]:
    """
    Renders an HTML email template and subject given a template_key and context variables.
    Returns (subject, html_body).
    """
    raw_store = vars_dict.get("store_name") or "WebCreon Store"
    store_name = clean_store_display_name(raw_store)
    customer_name = vars_dict.get("customer_name") or "Valued Customer"
    accent_color = vars_dict.get("accent_color") or "#2563eb"
    action_url = vars_dict.get("action_url") or vars_dict.get("order_url") or vars_dict.get("store_url") or vars_dict.get("reset_link")

    # 1. ORDER PLACED / RECEIPT
    if template_key in ("order_placed_receipt", "order_confirmed"):
        order_no = str(vars_dict.get("order_number") or vars_dict.get("order_id", ""))[:8].upper()
        order_total = vars_dict.get("total", "0.00")
        items = vars_dict.get("items", [])
        is_confirmed = template_key == "order_confirmed"

        subject = f"{store_name} - Order #{order_no} {'Confirmed' if is_confirmed else 'Receipt'}"
        title = "Order Confirmed!" if is_confirmed else "Order Placed Successfully!"
        badge = "Order Confirmed" if is_confirmed else "Receipt Confirmed"

        # Build items table rows safely
        items_rows = ""
        if items and isinstance(items, list):
            for it in items:
                if isinstance(it, dict):
                    p_name = it.get("product_name") or it.get("name") or "Item"
                    p_qty = it.get("quantity", 1)
                    p_price = it.get("line_total") or it.get("unit_price") or it.get("price") or "0.00"
                else:
                    p_name = getattr(it, "product_name", "Item")
                    p_qty = getattr(it, "quantity", 1)
                    p_price = getattr(it, "line_total", "0.00")
                items_rows += f"""
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-weight: 500;">{p_name}</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: center; color: #64748b;">x{p_qty}</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600;">₹{p_price}</td>
                </tr>
                """

        body = f"""
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">{title}</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Hi <strong>{customer_name}</strong>,<br>
            Thank you for shopping with <strong>{store_name}</strong>! Your order <strong>#{order_no}</strong> has been received and is being processed.
          </p>

          <div class="receipt-card">
            <table class="receipt-table" style="width: 100%;">
              <thead>
                <tr>
                  <th style="text-align: left;">Item</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items_rows if items_rows else '<tr><td colspan="3" style="padding: 8px 0;">Order Summary</td></tr>'}
                <tr>
                  <td colspan="2" style="padding: 12px 0 4px 0; font-weight: 800; font-size: 15px; color: #0f172a;">Total Paid</td>
                  <td style="padding: 12px 0 4px 0; text-align: right; font-weight: 800; font-size: 16px; color: #2563eb;">₹{order_total}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p style="font-size: 13px; color: #64748b; margin: 0;">
            You can view live delivery tracking and invoice details anytime by clicking below.
          </p>
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text=f"Order #{order_no} receipt from {store_name}",
            accent_color=accent_color,
            action_url=action_url,
            action_label="View Order Details",
            badge_label=badge,
            badge_color="#10b981",
        )

    # 2. ORDER SHIPPED
    elif template_key == "order_shipped":
        order_no = str(vars_dict.get("order_number") or vars_dict.get("order_id", ""))[:8].upper()
        courier = vars_dict.get("courier_name") or "Courier Partner"
        awb = vars_dict.get("awb_number") or ""
        subject = f"{store_name} - Order #{order_no} Has Shipped!"

        awb_box = ""
        if awb:
            awb_box = f"""
            <div class="badge-box">
              <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Tracking / AWB Number</div>
              <div class="badge-code">{awb}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Carrier: <strong>{courier}</strong></div>
            </div>
            """

        body = f"""
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Your Order is on the Way!</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Hi <strong>{customer_name}</strong>,<br>
            Great news! Your order <strong>#{order_no}</strong> has been handed over to <strong>{courier}</strong> and is in transit.
          </p>
          {awb_box}
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text=f"Your package from {store_name} is in transit",
            accent_color=accent_color,
            action_url=action_url,
            action_label="Track Order Live",
            badge_label="Package Dispatched",
            badge_color="#2563eb",
        )

    # 3. OUT FOR DELIVERY (WITH OTP)
    elif template_key == "order_out_for_delivery":
        order_no = str(vars_dict.get("order_number") or vars_dict.get("order_id", ""))[:8].upper()
        otp = vars_dict.get("delivery_otp") or ""
        subject = f"{store_name} - Order #{order_no} Out for Delivery!"

        otp_box = ""
        if otp:
            otp_box = f"""
            <div class="badge-box" style="background: #fefce8; border-color: #fde047;">
              <div style="font-size: 11px; font-weight: 700; color: #854d0e; text-transform: uppercase; letter-spacing: 0.05em;">Your Delivery Verification OTP</div>
              <div class="badge-code" style="color: #ca8a04;">{otp}</div>
              <div style="font-size: 12px; color: #a16207; margin-top: 4px;">Share this 4-digit code with your rider upon parcel arrival.</div>
            </div>
            """

        body = f"""
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Arriving Today!</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Hi <strong>{customer_name}</strong>,<br>
            Your order <strong>#{order_no}</strong> is out for delivery with our courier partner and will reach you shortly.
          </p>
          {otp_box}
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text=f"Order #{order_no} out for delivery today",
            accent_color=accent_color,
            action_url=action_url,
            action_label="View Delivery Status",
            badge_label="Out For Delivery",
            badge_color="#ca8a04",
        )

    # 4. ORDER DELIVERED
    elif template_key == "order_delivered":
        order_no = str(vars_dict.get("order_number") or vars_dict.get("order_id", ""))[:8].upper()
        subject = f"{store_name} - Order #{order_no} Delivered!"
        body = f"""
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Order Delivered!</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Hi <strong>{customer_name}</strong>,<br>
            Your order <strong>#{order_no}</strong> has been successfully delivered. We hope you love your purchase!
          </p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; font-size: 13px; color: #166534; margin: 16px 0;">
            ✓ Safe delivery verified by courier.
          </div>
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text=f"Order #{order_no} delivered",
            accent_color=accent_color,
            action_url=action_url,
            action_label="View Order Receipt",
            badge_label="Delivered",
            badge_color="#10b981",
        )

    # 5. PASSWORD RESET OTP
    elif template_key == "customer_password_reset":
        otp_code = vars_dict.get("otp_code", "")
        subject = f"{store_name} - Password Reset Verification Code"
        body = f"""
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Reset Your Password</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Hi <strong>{customer_name}</strong>,<br>
            We received a request to reset your password for your account at <strong>{store_name}</strong>.
          </p>

          <div class="badge-box">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Your 6-Digit Reset Code</div>
            <div class="badge-code">{otp_code}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Valid for 15 minutes</div>
          </div>

          <p style="font-size: 12.5px; color: #64748b; margin: 16px 0 0 0;">
            If you did not make this request, you can safely ignore this email. Your account remains secure.
          </p>
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text="Your password reset code",
            accent_color=accent_color,
            action_url=action_url,
            action_label="Reset Password",
            badge_label="Security Verification",
            badge_color="#2563eb",
        )

    # 6. WELCOME EMAIL
    elif template_key == "welcome_email":
        subject = f"Welcome to {store_name}!"
        body = f"""
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Welcome to {store_name}!</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Hi <strong>{customer_name}</strong>,<br>
            Thank you for creating an account with us. We're excited to have you on board! You can now easily track your orders, manage returns, and shop our latest collection.
          </p>
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text=f"Welcome to {store_name}",
            accent_color=accent_color,
            action_url=action_url,
            action_label="Start Shopping",
            badge_label="Account Created",
            badge_color="#10b981",
        )

    # 7. RETURNS & REFUNDS
    elif template_key in ("return_requested", "return_approved", "return_rejected", "return_received", "refund_completed"):
        order_no = str(vars_dict.get("order_number") or vars_dict.get("order_id", ""))[:8].upper()
        event_titles = {
            "return_requested": ("Return Request Received", "Your return request has been submitted and is under merchant review.", "Return Pending", "#ca8a04"),
            "return_approved": ("Return Request Approved", "Your return has been approved! Please keep the item packaged for pickup.", "Return Approved", "#10b981"),
            "return_rejected": ("Return Request Update", f"Your return request was not approved: {vars_dict.get('reject_reason', 'Item ineligible')}", "Return Rejected", "#ef4444"),
            "return_received": ("Returned Package Received", "We have received your returned package at our warehouse.", "Items Received", "#2563eb"),
            "refund_completed": ("Refund Processed", f"Your refund of ₹{vars_dict.get('refund_amount', '0.00')} has been processed successfully.", "Refund Completed", "#10b981"),
        }
        t_title, t_desc, t_badge, t_color = event_titles.get(template_key, ("Return Update", "Update on your return ticket.", "Return Update", "#2563eb"))
        subject = f"{store_name} - {t_title} (Order #{order_no})"

        body = f"""
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">{t_title}</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Hi <strong>{customer_name}</strong>,<br>
            {t_desc}
          </p>
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text=f"{t_title} for Order #{order_no}",
            accent_color=accent_color,
            action_url=action_url,
            action_label="View Return Status",
            badge_label=t_badge,
            badge_color=t_color,
        )

    # 8. SUPPORT TICKET
    elif template_key in ("support_ticket_created", "support_agent_replied", "support_ticket_resolved"):
        t_num = vars_dict.get("ticket_number") or "Ticket"
        subject = f"{store_name} - Support Case #{t_num}"
        msg_snippet = vars_dict.get("reply_message") or vars_dict.get("message") or "Support ticket update."

        body = f"""
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Customer Support Update</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Hi <strong>{customer_name}</strong>,<br>
            Here is an update on your support case <strong>#{t_num}</strong>:
          </p>
          <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 16px; margin: 16px 0; font-size: 13.5px; color: #334155; line-height: 1.5;">
            {msg_snippet}
          </div>
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text=f"Update on support ticket #{t_num}",
            accent_color=accent_color,
            action_url=action_url,
            action_label="View Support Ticket",
            badge_label="Support Desk",
            badge_color="#2563eb",
        )

    # 9. TEST CONNECTION EMAIL
    elif template_key == "test_email":
        subject = f"{store_name} - Test Connection Verified!"
        body = f"""
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">SMTP Test Succeeded!</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Congratulations! Your transactional email configuration for <strong>{store_name}</strong> is active and verified.
          </p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; font-size: 13px; color: #166534; margin: 16px 0;">
            ✓ SMTP Handshake, TLS/SSL connection, and sender authentication verified.
          </div>
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text="SMTP test verification",
            accent_color=accent_color,
            action_url=action_url,
            action_label="Visit Store",
            badge_label="Verified Connection",
            badge_color="#10b981",
        )

    # 10. ORDER CANCELLED
    elif template_key == "order_cancelled":
        order_number = vars_dict.get("order_number", "")
        order_id = vars_dict.get("order_id", "")
        total = vars_dict.get("total", "0.00")
        cancel_reason = vars_dict.get("cancel_reason", "Customer requested cancellation")
        refund_note = vars_dict.get("refund_note", "")
        order_url = vars_dict.get("order_url", action_url or "#")

        subject = f"Your Order #{order_number} Has Been Cancelled - {store_name}"
        refund_block = ""
        if refund_note:
            refund_block = f"""
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-size: 13px; color: #166534; font-weight: 600;">
              💸 Refund Information
            </p>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #166534; line-height: 1.5;">
              {refund_note}
            </p>
          </div>"""

        body = f"""
          <h2 style="margin: 0 0 6px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">Order #{order_number} Cancelled</h2>
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b; line-height: 1.6;">
            Hi <strong>{customer_name}</strong>, your order has been successfully cancelled.
          </p>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #9a3412; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;">Order #{order_number}</p>
            <p style="margin: 0; font-size: 14px; color: #7c2d12; line-height: 1.5;">
              <strong>Total:</strong> ₹{total}<br>
              <strong>Reason:</strong> {cancel_reason}
            </p>
          </div>
          {refund_block}
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text=f"Your order #{order_number} has been cancelled",
            accent_color=accent_color,
            action_url=order_url or action_url,
            action_label="View Order",
            badge_label="Cancelled",
            badge_color="#ef4444",
        )

    # DEFAULT / GENERIC
    else:
        title = vars_dict.get("title") or "Customer Notification"
        message = vars_dict.get("message") or "You have a new notification from our store."
        subject = f"{store_name} - {title}"
        body = f"""
          <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">{title}</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Hi <strong>{customer_name}</strong>,<br>
            {message}
          </p>
        """
        return subject, _base_email_layout(
            store_name,
            body,
            preview_text=title,
            accent_color=accent_color,
            action_url=action_url,
            action_label="View Details",
        )
