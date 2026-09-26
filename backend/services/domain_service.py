from __future__ import annotations

import ipaddress
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from uuid import UUID

from sqlmodel import Session, col, select

from models import Site, SiteDomain, SiteSlugHistory


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


PLATFORM_BASE_DOMAIN = os.getenv("PLATFORM_BASE_DOMAIN", "webcreon.in").strip().lower().strip(".")
CUSTOM_DOMAIN_ROUTING_TARGET = os.getenv("CUSTOM_DOMAIN_ROUTING_TARGET", f"cname.{PLATFORM_BASE_DOMAIN}").strip().lower().strip(".")
CHALLENGE_PREFIX = "_webcreon-challenge"
SLUG_HOLD_DAYS = 90

RESERVED_SLUGS = {
    "api", "admin", "app", "auth", "login", "signup", "register", "logout",
    "static", "assets", "dashboard", "settings", "webhook", "webhooks",
    "mail", "docs", "status", "cname", "cdn", "staging", "dev", "prod",
    "test", "support", "help", "checkout", "cart", "account", "billing",
    "system", "router", "edge", "gateway", "ns1", "ns2", "dns", "ssl",
    "root", "null", "undefined", "localhost", "internal", "webcreon"
}

INVALID_TLDS = {
    "localhost", "internal", "example", "invalid", "lan", "home", "corp"
}

# Label regex RFC 1123: 1-63 chars, alphanumeric and internal hyphens
LABEL_REGEX = re.compile(r"^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$")
SLUG_REGEX = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class DomainValidationError(ValueError):
    """Custom exception for domain validation errors with user-friendly messages."""
    pass


def normalize_custom_domain(raw_domain: str) -> Tuple[str, str]:
    """
    Normalizes and validates a custom domain string.
    Enforces V1 policy: rejects bare apex domains and directs user to subdomain/www.
    Returns (normalized_domain, domain_type).
    """
    if not raw_domain or not isinstance(raw_domain, str):
        raise DomainValidationError("Domain cannot be empty.")

    clean = raw_domain.strip().lower()

    # Strip scheme if accidentally pasted
    clean = re.sub(r"^https?://", "", clean)
    # Strip paths, queries, fragments
    clean = clean.split("/")[0].split("?")[0].split("#")[0]
    # Strip port if present
    clean = clean.split(":")[0]
    # Remove trailing dot (DNS root)
    clean = clean.strip(".")

    if not clean:
        raise DomainValidationError("Please provide a valid domain name.")

    # Check for IP address
    try:
        ipaddress.ip_address(clean)
    except ValueError:
        pass
    else:
        raise DomainValidationError("IP addresses cannot be used as custom domains.")

    # Check length
    if len(clean) > 253:
        raise DomainValidationError("Domain name exceeds maximum length of 253 characters.")

    labels = clean.split(".")
    if len(labels) < 2:
        raise DomainValidationError("Please enter a fully-qualified domain name (e.g., shop.brand.com or www.brand.com).")

    # Validate each label
    for label in labels:
        if not label:
            raise DomainValidationError("Domain contains empty labels.")
        if len(label) > 63:
            raise DomainValidationError(f"Domain label '{label}' exceeds 63 characters.")
        if not LABEL_REGEX.match(label):
            raise DomainValidationError(
                f"Label '{label}' is invalid. Domain labels must contain only alphanumeric characters and hyphens, and cannot start or end with a hyphen."
            )

    tld = labels[-1]
    is_dev_mode = (
        os.getenv("DNS_VERIFY_MOCK", "").lower() in ("true", "1", "yes")
        or os.getenv("ENVIRONMENT", "development").lower() != "production"
        or os.getenv("DOMAIN_PROVIDER", "mock").lower() == "mock"
    )

    if tld in ("test", "local") and not is_dev_mode:
        raise DomainValidationError(f"'.{tld}' domains can only be used in local development environments.")

    if (tld in INVALID_TLDS or tld.isdigit()) and not (is_dev_mode and tld in ("test", "local")):
        raise DomainValidationError(f"'.{tld}' is a reserved or invalid top-level domain.")

    # Prevent connecting Webcreon base platform domain directly
    if clean == PLATFORM_BASE_DOMAIN or clean.endswith(f".{PLATFORM_BASE_DOMAIN}"):
        raise DomainValidationError(f"Domains on {PLATFORM_BASE_DOMAIN} are managed via Webcreon Subdomains.")

    # V1 Constraint: Reject bare apex domains
    # If 2 parts (e.g. example.com) or 3 parts with common ccTLD (e.g. example.co.uk)
    # Common multi-part ccTLDs: .co.uk, .com.au, .co.in, .org.uk, .co.nz, etc.
    is_bare_apex = False
    if len(labels) == 2:
        is_bare_apex = True
    elif len(labels) == 3:
        second_level = labels[-2]
        if second_level in {"co", "com", "org", "net", "edu", "gov", "ac", "res", "gen"}:
            is_bare_apex = True

    if is_bare_apex:
        raise DomainValidationError(
            f"Bare apex domains ('{clean}') require ANAME/ALIAS flattening and are not supported in V1. "
            f"Please connect a subdomain such as 'www.{clean}' or 'shop.{clean}'."
        )

    # Classify domain type
    if labels[0] == "www":
        domain_type = "custom_www"
    else:
        domain_type = "custom_subdomain"

    return clean, domain_type


def validate_and_normalize_slug(raw_slug: str) -> str:
    """
    Validates and normalizes a Webcreon subdomain slug.
    Length: 3 to 63 chars.
    Alphanumeric and hyphens, no consecutive hyphens, no leading/trailing hyphens.
    Must not be in reserved words.
    """
    if not raw_slug or not isinstance(raw_slug, str):
        raise DomainValidationError("Subdomain slug cannot be empty.")

    slug = raw_slug.strip().lower()

    if len(slug) < 3 or len(slug) > 63:
        raise DomainValidationError("Subdomain slug must be between 3 and 63 characters long.")

    if not SLUG_REGEX.match(slug):
        raise DomainValidationError(
            "Subdomain slug may only contain lowercase letters, numbers, and single hyphens. "
            "It cannot start or end with a hyphen."
        )

    if slug in RESERVED_SLUGS:
        raise DomainValidationError(f"The slug '{slug}' is reserved by the Webcreon platform.")

    return slug


def check_slug_availability(
    slug: str,
    site_id: UUID,
    session: Session,
) -> Tuple[bool, Optional[str]]:
    """
    Checks if a slug is available for the given site.
    Enforces active uniqueness and 90-day anti-squatting hold on previously released slugs.
    """
    # 1. Check active site slugs
    existing_site = session.exec(
        select(Site).where(Site.slug == slug, Site.id != site_id)
    ).first()
    if existing_site:
        return False, f"The subdomain '{slug}.{PLATFORM_BASE_DOMAIN}' is already taken by another store."

    # 2. Check 90-day anti-squatting hold history
    now = utc_now()
    history = session.exec(
        select(SiteSlugHistory).where(
            SiteSlugHistory.old_slug == slug,
            SiteSlugHistory.site_id != site_id,
            SiteSlugHistory.reserved_until > now,
        )
    ).first()

    if history:
        days_remaining = max(1, (history.reserved_until - now).days)
        return (
            False,
            f"The subdomain '{slug}.{PLATFORM_BASE_DOMAIN}' was previously used by another store "
            f"and is in a security cooldown hold ({days_remaining} days remaining)."
        )

    return True, None


def generate_verification_token() -> str:
    """Generates a cryptographically strong 32-byte URL-safe token."""
    return f"wc_txt_{secrets.token_urlsafe(32)}"


def get_dns_instructions(domain: str, verification_token: str) -> dict:
    """
    Constructs the exact DNS records the store owner must add with their DNS provider.
    Includes both CNAME routing and TXT cryptographic ownership verification.
    """
    cname_host = domain
    txt_host = f"{CHALLENGE_PREFIX}.{domain}"

    return {
        "domain": domain,
        "routing_target": CUSTOM_DOMAIN_ROUTING_TARGET,
        "records": [
            {
                "type": "CNAME",
                "name": cname_host,
                "value": CUSTOM_DOMAIN_ROUTING_TARGET,
                "purpose": "Traffic Routing & CDN Edge",
                "ttl": 300,
                "required": True,
            },
            {
                "type": "TXT",
                "name": txt_host,
                "value": verification_token,
                "purpose": "Cryptographic Ownership Verification",
                "ttl": 300,
                "required": True,
            },
        ],
    }


def set_primary_domain(
    site_id: UUID,
    domain_id: UUID,
    session: Session,
) -> SiteDomain:
    """
    Atomically sets a domain as primary for a site.
    Invariant: Only a domain in 'connected' status can be set as primary.
    """
    target = session.get(SiteDomain, domain_id)
    if not target or target.site_id != site_id:
        raise DomainValidationError("Domain not found for this site.")

    if target.status != "connected":
        raise DomainValidationError(
            f"Only verified and connected domains can be set as primary. Current status: '{target.status}'."
        )

    # Atomically demote any currently primary domains
    existing_primaries = session.exec(
        select(SiteDomain).where(
            SiteDomain.site_id == site_id,
            SiteDomain.is_primary == True,  # noqa: E712
            SiteDomain.id != domain_id,
        )
    ).all()

    for dom in existing_primaries:
        dom.is_primary = False
        session.add(dom)
    session.flush()

    target.is_primary = True
    target.updated_at = utc_now()
    session.add(target)
    session.commit()
    session.refresh(target)

    return target
