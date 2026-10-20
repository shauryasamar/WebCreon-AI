from __future__ import annotations

import hmac
import logging
import os
from typing import Any, Dict, List, Optional

from services.domain_service import CHALLENGE_PREFIX, CUSTOM_DOMAIN_ROUTING_TARGET

logger = logging.getLogger(__name__)

# Attempt to import dnspython if installed
HAS_DNSPYTHON = False
try:
    import dns.resolver
    import dns.name
    import dns.query
    import dns.message
    import dns.rdatatype
    HAS_DNSPYTHON = True
except ImportError:
    HAS_DNSPYTHON = False


DEFAULT_RECURSIVE_RESOLVERS = ["1.1.1.1", "8.8.8.8", "9.9.9.9"]


class DnsVerificationResult:
    def __init__(
        self,
        verified: bool,
        cname_verified: bool,
        cname_found: Optional[str],
        cname_expected: str,
        txt_verified: bool,
        txt_found: List[str],
        txt_expected: str,
        error_message: Optional[str] = None,
    ):
        self.verified = verified
        self.cname_verified = cname_verified
        self.cname_found = cname_found
        self.cname_expected = cname_expected
        self.txt_verified = txt_verified
        self.txt_found = txt_found
        self.txt_expected = txt_expected
        self.error_message = error_message

    def to_dict(self) -> Dict[str, Any]:
        return {
            "verified": self.verified,
            "cname_verified": self.cname_verified,
            "cname_found": self.cname_found,
            "cname_expected": self.cname_expected,
            "txt_verified": self.txt_verified,
            "txt_found": self.txt_found,
            "txt_expected": self.txt_expected,
            "error_message": self.error_message,
        }


def _resolve_with_dnspython(
    hostname: str,
    record_type: str,
) -> List[str]:
    """Resolves DNS records using dnspython across primary public recursive resolvers."""
    if not HAS_DNSPYTHON:
        return []

    answers: List[str] = []
    resolver = dns.resolver.Resolver(configure=False)
    resolver.nameservers = DEFAULT_RECURSIVE_RESOLVERS
    resolver.timeout = 3.0
    resolver.lifetime = 6.0

    try:
        query_result = resolver.resolve(hostname, record_type)
        for rdata in query_result:
            if record_type == "CNAME":
                answers.append(str(rdata.target).rstrip(".").lower())
            elif record_type == "TXT":
                # TXT records can be multi-chunk strings
                txt_str = "".join(part.decode("utf-8", errors="replace") if isinstance(part, bytes) else str(part) for part in rdata.strings)
                answers.append(txt_str.strip())
            else:
                answers.append(str(rdata).strip())
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        pass
    except Exception as e:
        logger.warning(f"dnspython query failed for {hostname} ({record_type}): {e}")

    return answers


def _resolve_system_fallback(hostname: str) -> Optional[str]:
    """Fallback resolution when dnspython is absent or in local dev."""
    import socket
    try:
        # Check canonical host name
        canonical, aliases, _ = socket.gethostbyname_ex(hostname)
        all_names = [canonical.lower().rstrip(".")] + [a.lower().rstrip(".") for a in aliases]
        target = CUSTOM_DOMAIN_ROUTING_TARGET.rstrip(".").lower()
        if target in all_names:
            return target
        return canonical.lower().rstrip(".")
    except Exception:
        return None


def verify_domain_dns(
    domain: str,
    verification_token: str,
    expected_target: Optional[str] = None,
) -> DnsVerificationResult:
    """
    Verifies that:
    1. CNAME of `domain` points to `CUSTOM_DOMAIN_ROUTING_TARGET`.
    2. TXT record of `_webcreon-challenge.<domain>` contains `verification_token`.
    Supports local dev mock override via environment variable DNS_VERIFY_MOCK=true.
    """
    target = (expected_target or CUSTOM_DOMAIN_ROUTING_TARGET).strip().rstrip(".").lower()
    challenge_host = f"{CHALLENGE_PREFIX}.{domain}".lower()

    # Local development or test mock override
    if os.getenv("DNS_VERIFY_MOCK", "").lower() in ("true", "1", "yes") or domain.endswith(".test") or domain.endswith(".local"):
        return DnsVerificationResult(
            verified=True,
            cname_verified=True,
            cname_found=target,
            cname_expected=target,
            txt_verified=True,
            txt_found=[verification_token],
            txt_expected=verification_token,
            error_message=None,
        )

    cname_found: Optional[str] = None
    cname_verified = False
    txt_found: List[str] = []
    txt_verified = False

    if HAS_DNSPYTHON:
        cname_records = _resolve_with_dnspython(domain, "CNAME")
        if cname_records:
            cname_found = cname_records[0]
            if cname_found == target:
                cname_verified = True

        txt_records = _resolve_with_dnspython(challenge_host, "TXT")
        txt_found = txt_records
        for candidate in txt_records:
            if hmac.compare_digest(candidate, verification_token):
                txt_verified = True
                break
    else:
        # System socket fallback
        system_target = _resolve_system_fallback(domain)
        if system_target:
            cname_found = system_target
            if system_target == target:
                cname_verified = True

        # In dev environments without external DNS servers or dnspython, if mock or token matches:
        if not HAS_DNSPYTHON and not cname_verified:
            logger.info("dnspython not installed; relying on socket resolution and mock fallback for testing.")

    error_parts: List[str] = []
    if not cname_verified:
        if cname_found:
            error_parts.append(f"CNAME currently points to '{cname_found}', expected '{target}'.")
        else:
            error_parts.append(f"CNAME record pointing to '{target}' was not found.")

    if not txt_verified:
        if txt_found:
            error_parts.append(f"TXT record '{challenge_host}' does not contain the required verification token.")
        else:
            error_parts.append(f"TXT record '{challenge_host}' was not found. Please verify DNS records have propagated.")

    verified = cname_verified and txt_verified
    error_msg = " ".join(error_parts) if error_parts else None

    return DnsVerificationResult(
        verified=verified,
        cname_verified=cname_verified,
        cname_found=cname_found,
        cname_expected=target,
        txt_verified=txt_verified,
        txt_found=txt_found,
        txt_expected=verification_token,
        error_message=error_msg,
    )
