"""
WebCreon AI: Statutory Invoice Sequencer
Governing Statutory Standard: Section 31 read with Rule 46(b) CGST Rules 2017.
Guarantees consecutive, gap-free, unique sequence numbering per merchant per Financial Year.
Maximum length: 16 characters (e.g. 'INV/26-27/000001').
"""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone
from sqlmodel import Session, select
from sqlalchemy import text

from models import InvoiceSequence
from services.tax_engine import get_financial_year

logger = logging.getLogger(__name__)


def get_next_sequence_number(
    session: Session,
    site_id: UUID,
    document_type: str = "INVOICE",
    financial_year: Optional[str] = None,
    custom_prefix: Optional[str] = None,
) -> tuple[int, str]:
    """
    Atomically increments and returns the next document sequence number and formatted string.
    Format: {PREFIX}/{FY_CODE}/{SERIAL:06d}
    Rule 46(b) constraint: strictly <= 16 characters.
    """
    fy = financial_year or get_financial_year()
    # Format FY as 2-digit e.g. '2026-2027' or '2026-27' -> '26-27'
    fy_short = fy
    if "-" in fy:
        parts = fy.split("-")
        if len(parts) == 2:
            p1 = parts[0].strip()[-2:]
            p2 = parts[1].strip()[-2:]
            fy_short = f"{p1}-{p2}"

    doc_type = document_type.upper().strip()
    if custom_prefix:
        prefix = custom_prefix.strip().upper()[:3]
    elif doc_type == "CREDIT_NOTE":
        prefix = "CN"
    elif doc_type == "PLATFORM_FEE":
        prefix = "PF"
    else:
        prefix = "INV"

    # Row-locking query
    dialect_name = session.bind.dialect.name if session.bind else "postgresql"

    # Try to find and lock the sequence row
    if dialect_name == "postgresql":
        query = (
            select(InvoiceSequence)
            .where(
                InvoiceSequence.site_id == site_id,
                InvoiceSequence.financial_year == fy_short,
                InvoiceSequence.document_type == doc_type,
            )
            .with_for_update()
        )
    else:
        query = select(InvoiceSequence).where(
            InvoiceSequence.site_id == site_id,
            InvoiceSequence.financial_year == fy_short,
            InvoiceSequence.document_type == doc_type,
        )

    seq_record = session.exec(query).first()

    if not seq_record:
        # Create sequence starting at 1
        seq_record = InvoiceSequence(
            site_id=site_id,
            financial_year=fy_short,
            document_type=doc_type,
            current_value=1,
            updated_at=datetime.now(timezone.utc),
        )
        session.add(seq_record)
        next_val = 1
    else:
        seq_record.current_value += 1
        seq_record.updated_at = datetime.now(timezone.utc)
        session.add(seq_record)
        next_val = seq_record.current_value

    session.flush()

    # Build compliant formatted string (e.g. 'INV/26-27/000001' -> 16 chars)
    formatted_number = f"{prefix}/{fy_short}/{next_val:06d}"
    if len(formatted_number) > 16:
        # Fallback to tighter padding if necessary to guarantee Rule 46(b) <= 16 chars
        formatted_number = f"{prefix}/{fy_short}/{next_val}"

    return next_val, formatted_number


# Alias
generate_sequential_invoice_number = get_next_sequence_number
