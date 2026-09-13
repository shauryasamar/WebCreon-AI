"""
Reliable Asynchronous Notification Queue with Dead-Letter Queue (DLQ) & Retry.

Guarantees:
1. Order placement and payment fulfillment transactions are NEVER blocked or rolled back by notification failures.
2. Failed notifications are retried with exponential backoff (e.g. 3 attempts: 1s, 4s, 16s).
3. Exhausted messages move to a Dead-Letter Queue (DLQ) for inspection and manual re-triggering.
"""

import time
import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger("notification_queue")

# Thread pool for non-blocking notification dispatches
_NOTIFICATION_EXECUTOR = ThreadPoolExecutor(max_workers=5, thread_name_prefix="notif-worker")

# Dead-Letter Queue in-memory repository (and audit tracking)
NOTIFICATION_DLQ: List[Dict[str, Any]] = []


class NotificationMessage:
    def __init__(
        self,
        order_id: str,
        site_id: str,
        channel: str,  # 'email' | 'sms' | 'whatsapp'
        recipient: str,
        payload: Dict[str, Any],
        max_retries: int = 3,
    ):
        self.order_id = order_id
        self.site_id = site_id
        self.channel = channel
        self.recipient = recipient
        self.payload = payload
        self.max_retries = max_retries
        self.attempts = 0
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.last_error: Optional[str] = None


def _dispatch_worker(message: NotificationMessage, send_fn: Optional[Callable] = None):
    """
    Worker executing retry with exponential backoff.
    """
    backoff_seconds = [1, 4, 16]

    while message.attempts < message.max_retries:
        message.attempts += 1
        try:
            if send_fn:
                send_fn(message)
            else:
                # Default simulator/logger dispatch
                logger.info(
                    "Notification dispatched successfully: Order=%s, Channel=%s, Recipient=%s (Attempt %d)",
                    message.order_id,
                    message.channel,
                    message.recipient,
                    message.attempts,
                )
            return  # Success
        except Exception as ex:
            message.last_error = str(ex)
            logger.warning(
                "Notification dispatch failed (Attempt %d/%d) for Order %s: %s",
                message.attempts,
                message.max_retries,
                message.order_id,
                ex,
            )
            if message.attempts < message.max_retries:
                sleep_time = backoff_seconds[min(message.attempts - 1, len(backoff_seconds) - 1)]
                time.sleep(sleep_time)

    # If all retries exhausted, send to Dead-Letter Queue
    dlq_entry = {
        "order_id": message.order_id,
        "site_id": message.site_id,
        "channel": message.channel,
        "recipient": message.recipient,
        "payload": message.payload,
        "attempts": message.attempts,
        "last_error": message.last_error,
        "created_at": message.created_at,
        "failed_at": datetime.now(timezone.utc).isoformat(),
    }
    NOTIFICATION_DLQ.append(dlq_entry)
    if len(NOTIFICATION_DLQ) > 500:
        NOTIFICATION_DLQ.pop(0)

    logger.error(
        "NOTIFICATION_DLQ_ALERT: Notification for Order %s moved to Dead-Letter Queue after %d failed attempts.",
        message.order_id,
        message.max_retries,
    )


def enqueue_notification(
    order_id: str,
    site_id: str,
    channel: str,
    recipient: str,
    payload: Dict[str, Any],
    max_retries: int = 3,
    send_fn: Optional[Callable] = None,
):
    """
    Non-blocking async enqueue for order confirmations/receipts.
    """
    msg = NotificationMessage(
        order_id=order_id,
        site_id=site_id,
        channel=channel,
        recipient=recipient,
        payload=payload,
        max_retries=max_retries,
    )
    _NOTIFICATION_EXECUTOR.submit(_dispatch_worker, msg, send_fn)


def get_dlq_entries() -> List[Dict[str, Any]]:
    return list(NOTIFICATION_DLQ)


def clear_dlq():
    NOTIFICATION_DLQ.clear()
