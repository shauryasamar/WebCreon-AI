from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlmodel import Session, col, func, select

from auth_middleware import (
    authenticate_admin,
    enforce_site_ownership,
    get_session,
    require_permission,
)
from models import Admin, AdminSite, Role, Site, SiteDomain, SiteSlugHistory, ProcessedProviderEvent
from services.audit_service import (
    ActorType,
    AuditCategory,
    AuditService,
    SourceType,
    extract_client_metadata,
)
from services.dns_service import verify_domain_dns
from services.domain_provider import get_domain_provider
from services.domain_service import (
    CUSTOM_DOMAIN_ROUTING_TARGET,
    PLATFORM_BASE_DOMAIN,
    SLUG_HOLD_DAYS,
    DomainValidationError,
    check_slug_availability,
    generate_verification_token,
    get_dns_instructions,
    normalize_custom_domain,
    set_primary_domain,
    utc_now,
    validate_and_normalize_slug,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["domains"])


# ---------------------------------------------------------------------------
# REQUEST SCHEMAS
# ---------------------------------------------------------------------------

class AddDomainRequest(BaseModel):
    domain: str = Field(..., description="Custom domain to connect (e.g. shop.brand.com or www.brand.com)")


class ChangeSlugRequest(BaseModel):
    new_slug: str = Field(..., description="New Webcreon subdomain slug (3-63 chars, lowercase alphanumeric with hyphens)")


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _get_admin_actor_context(admin: dict) -> dict:
    role = (admin.get("role") or "").lower()
    actor_type = ActorType.OWNER if (role == "owner" or admin.get("is_owner")) else ActorType.TEAM_MEMBER
    try:
        admin_uuid = UUID(str(admin["adminId"]))
    except Exception:
        admin_uuid = None
    return {
        "actor_type": actor_type,
        "actor_id": admin_uuid,
        "actor_name": admin.get("name"),
        "actor_email": admin.get("email"),
        "actor_role": admin.get("role") or "Staff",
    }


def _serialize_domain(dom: SiteDomain) -> dict:
    instructions = get_dns_instructions(dom.domain, dom.verification_token)
    return {
        "id": str(dom.id),
        "site_id": str(dom.site_id),
        "domain": dom.domain,
        "is_primary": dom.is_primary,
        "domain_type": dom.domain_type,
        "status": dom.status,
        "ssl_status": dom.ssl_status,
        "dns_record_type": dom.dns_record_type,
        "dns_record_name": dom.dns_record_name,
        "dns_record_value": dom.dns_record_value,
        "verification_token": dom.verification_token,
        "last_verified_at": dom.last_verified_at.isoformat() if dom.last_verified_at else None,
        "error_message": dom.error_message,
        "created_at": dom.created_at.isoformat() if dom.created_at else None,
        "dns_instructions": instructions,
    }


def _format_display_name(site: Site) -> str:
    s_def = site.site_definition if isinstance(site.site_definition, dict) else {}
    for key in ("site_name", "name", "title", "business_name", "store_name", "brand_name"):
        val = s_def.get(key)
        if val and isinstance(val, str) and val.strip() and val.strip() != site.slug:
            return val.strip()
    
    slug = site.slug or ""
    import re
    clean = re.sub(r"-\d{10,}$", "", slug)
    clean = clean.replace("-", " ").replace("_", " ").strip()
    return clean.title() if clean else "Untitled Store"


# ---------------------------------------------------------------------------
# 1. ACCOUNT-LEVEL OVERVIEW
# ---------------------------------------------------------------------------

@router.get("/api/domains/overview")
def get_domains_overview(
    admin=Depends(authenticate_admin),
    session: Session = Depends(get_session),
):
    """
    Returns an account-level list of all websites the admin has access to,
    their Webcreon subdomain, connected custom domains, primary domain, and health status.
    """
    admin_id = admin["adminId"]
    try:
        admin_uuid = UUID(str(admin_id))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid admin token payload")

    admin_obj = session.get(Admin, admin_uuid)
    if not admin_obj or not admin_obj.is_active:
        raise HTTPException(status_code=403, detail="Admin account is inactive or not found")

    role_obj = None
    if admin_obj.role_id:
        try:
            r_uuid = UUID(str(admin_obj.role_id))
            role_obj = session.get(Role, r_uuid)
        except Exception:
            pass

    is_owner = (role_obj.name == "Owner") if role_obj else (admin_obj.role in ("Owner", "super_admin"))
    website_access_type = getattr(admin_obj, "website_access_type", "all") or "all"

    # 1. Identify Workspace Owner:
    if admin_obj.invited_by_admin_id:
        owner_obj = session.get(Admin, admin_obj.invited_by_admin_id)
        site_owner = owner_obj or admin_obj
    else:
        site_owner = admin_obj

    # 2. Collect workspace sites belonging to this workspace owner:
    owner_site_links = session.exec(
        select(AdminSite.site_id).where(AdminSite.admin_id == site_owner.id)
    ).all()
    owner_site_ids = set(owner_site_links)

    # Also include any direct site links for this admin:
    admin_site_links = session.exec(
        select(AdminSite.site_id).where(AdminSite.admin_id == admin_uuid)
    ).all()
    admin_site_ids = set(admin_site_links)

    is_all_access = is_owner or (website_access_type == "all")

    if is_all_access:
        accessible_site_ids = list(owner_site_ids | admin_site_ids)
    else:
        accessible_site_ids = list(admin_site_ids)

    # Fetch authorized sites belonging strictly to this workspace
    if not accessible_site_ids:
        sites = []
    else:
        sites = session.exec(
            select(Site).where(col(Site.id).in_(accessible_site_ids)).order_by(Site.created_at.desc())
        ).all()

    overview_items = []
    for site in sites:
        domains = session.exec(
            select(SiteDomain)
            .where(SiteDomain.site_id == site.id)
            .order_by(SiteDomain.is_primary.desc(), SiteDomain.created_at.desc())
        ).all()

        active_primary = next((d for d in domains if d.is_primary and d.status == "connected"), None)
        has_dns_required = any(d.status in ("dns_required", "dns_failed") for d in domains)
        has_ssl_pending = any(d.ssl_status == "ssl_pending" for d in domains)
        all_connected = len(domains) > 0 and all(d.status == "connected" for d in domains)

        if not domains:
            health_status = "subdomain_only"
        elif all_connected:
            health_status = "connected"
        elif has_dns_required:
            health_status = "dns_required"
        elif has_ssl_pending:
            health_status = "ssl_pending"
        else:
            health_status = "attention_needed"

        overview_items.append({
            "site_id": str(site.id),
            "site_name": _format_display_name(site),
            "slug": site.slug,
            "is_published": site.is_published,
            "webcreon_url": f"https://{site.slug}.{PLATFORM_BASE_DOMAIN}",
            "custom_domains_count": len(domains),
            "primary_domain": _serialize_domain(active_primary) if active_primary else None,
            "health_status": health_status,
            "domains": [_serialize_domain(d) for d in domains],
            "updated_at": site.updated_at.isoformat() if hasattr(site, "updated_at") and site.updated_at else None,
        })

    return {
        "platform_base_domain": PLATFORM_BASE_DOMAIN,
        "custom_domain_routing_target": CUSTOM_DOMAIN_ROUTING_TARGET,
        "stores": overview_items,
    }


# ---------------------------------------------------------------------------
# 2. SITE-LEVEL DOMAINS MANAGEMENT
# ---------------------------------------------------------------------------

@router.get("/api/sites/{site_id}/domains")
def get_site_domains(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Returns all custom domains and Webcreon subdomain configuration for a specific store.
    """
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    domains = session.exec(
        select(SiteDomain)
        .where(SiteDomain.site_id == site_id)
        .order_by(SiteDomain.is_primary.desc(), SiteDomain.created_at.desc())
    ).all()

    return {
        "site_id": str(site.id),
        "site_name": site.name or "Untitled Store",
        "slug": site.slug,
        "is_published": site.is_published,
        "webcreon_subdomain": f"{site.slug}.{PLATFORM_BASE_DOMAIN}",
        "webcreon_url": f"https://{site.slug}.{PLATFORM_BASE_DOMAIN}",
        "platform_base_domain": PLATFORM_BASE_DOMAIN,
        "custom_domain_routing_target": CUSTOM_DOMAIN_ROUTING_TARGET,
        "custom_domains": [_serialize_domain(d) for d in domains],
    }


@router.post("/api/sites/{site_id}/domains", status_code=status.HTTP_201_CREATED)
def add_custom_domain(
    site_id: UUID,
    payload: AddDomainRequest,
    request: Request,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Connects a new custom domain to the store.
    Validates formatting, rejects bare apex domains in V1, checks global uniqueness,
    and returns required CNAME and TXT verification records.
    """
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    try:
        normalized_domain, domain_type = normalize_custom_domain(payload.domain)
    except DomainValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check if domain already registered anywhere
    existing_domain = session.exec(
        select(SiteDomain).where(SiteDomain.domain == normalized_domain)
    ).first()

    if existing_domain:
        if existing_domain.site_id == site_id:
            raise HTTPException(
                status_code=409,
                detail=f"Domain '{normalized_domain}' is already connected to this store.",
            )
        else:
            raise HTTPException(
                status_code=409,
                detail=f"Domain '{normalized_domain}' is already registered to another store. "
                "If you are the rightful domain owner, please contact support to resolve domain conflicts.",
            )

    verification_token = generate_verification_token()

    new_domain = SiteDomain(
        site_id=site_id,
        domain=normalized_domain,
        domain_type=domain_type,
        is_primary=False,  # Invariant: newly added domains cannot be primary until verified & connected
        status="dns_required",
        ssl_status="ssl_pending",
        dns_record_type="CNAME",
        dns_record_name=normalized_domain,
        dns_record_value=CUSTOM_DOMAIN_ROUTING_TARGET,
        verification_token=verification_token,
        error_message=None,
    )

    session.add(new_domain)
    session.commit()
    session.refresh(new_domain)

    # Audit Logging
    actor = _get_admin_actor_context(ownership)
    ip_address, user_agent, req_id = extract_client_metadata(request)

    AuditService.log_event(
        site_id=site.id,
        actor_type=actor["actor_type"],
        actor_id=actor["actor_id"],
        actor_name=actor["actor_name"],
        actor_email=actor["actor_email"],
        actor_role=actor["actor_role"],
        category=AuditCategory.WEBSITE_STORE,
        action="domain.added",
        source=SourceType.WEB_ADMIN,
        resource_type="site_domain",
        resource_id=str(new_domain.id),
        resource_name=new_domain.domain,
        summary=f"Added custom domain '{new_domain.domain}' (pending DNS verification)",
        metadata={
            "domain": new_domain.domain,
            "domain_type": new_domain.domain_type,
            "routing_target": CUSTOM_DOMAIN_ROUTING_TARGET,
        },
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=req_id,
    )

    return _serialize_domain(new_domain)


@router.post("/api/sites/{site_id}/domains/{domain_id}/verify")
def verify_domain(
    site_id: UUID,
    domain_id: UUID,
    request: Request,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Performs server-side cryptographic TXT and CNAME DNS verification.
    If valid, registers the custom domain with the edge provider and initiates SSL issuance.
    """
    dom = session.get(SiteDomain, domain_id)
    if not dom or dom.site_id != site_id:
        raise HTTPException(status_code=404, detail="Domain not found for this store.")

    # 1. Verify DNS records
    dns_result = verify_domain_dns(
        domain=dom.domain,
        verification_token=dom.verification_token,
    )

    actor = _get_admin_actor_context(ownership)
    ip_address, user_agent, req_id = extract_client_metadata(request)

    if not dns_result.verified:
        dom.status = "dns_required"
        dom.error_message = dns_result.error_message
        dom.updated_at = utc_now()
        session.add(dom)
        session.commit()
        session.refresh(dom)

        AuditService.log_event(
            site_id=site_id,
            actor_type=actor["actor_type"],
            actor_id=actor["actor_id"],
            actor_name=actor["actor_name"],
            actor_email=actor["actor_email"],
            actor_role=actor["actor_role"],
            category=AuditCategory.WEBSITE_STORE,
            action="domain.verify_failed",
            source=SourceType.WEB_ADMIN,
            resource_type="site_domain",
            resource_id=str(dom.id),
            resource_name=dom.domain,
            summary=f"DNS verification failed for domain '{dom.domain}': {dns_result.error_message}",
            metadata=dns_result.to_dict(),
            status="warning",
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=req_id,
        )

        return {
            "verified": False,
            "status": dom.status,
            "ssl_status": dom.ssl_status,
            "error_message": dom.error_message,
            "dns_details": dns_result.to_dict(),
        }

    # 2. DNS is verified! Provision with edge provider
    provider = get_domain_provider()
    try:
        prov_res = provider.register_custom_domain(dom.domain, str(site_id))
        dom.status = "connected"
        dom.ssl_status = prov_res.get("ssl_status", "ssl_active")
        dom.last_verified_at = utc_now()
        dom.error_message = None
        dom.updated_at = utc_now()

        # Check if this should be auto-promoted to primary (if no active connected primary exists)
        has_primary = session.exec(
            select(SiteDomain).where(
                SiteDomain.site_id == site_id,
                SiteDomain.is_primary == True,  # noqa: E712
                SiteDomain.status == "connected",
            )
        ).first()

        if not has_primary:
            dom.is_primary = True

        session.add(dom)
        session.commit()
        session.refresh(dom)

        AuditService.log_event(
            site_id=site_id,
            actor_type=actor["actor_type"],
            actor_id=actor["actor_id"],
            actor_name=actor["actor_name"],
            actor_email=actor["actor_email"],
            actor_role=actor["actor_role"],
            category=AuditCategory.WEBSITE_STORE,
            action="domain.verified",
            source=SourceType.WEB_ADMIN,
            resource_type="site_domain",
            resource_id=str(dom.id),
            resource_name=dom.domain,
            summary=f"Successfully verified DNS and connected domain '{dom.domain}'",
            metadata={
                "domain": dom.domain,
                "is_primary": dom.is_primary,
                "provider_result": prov_res,
            },
            status="success",
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=req_id,
        )

        return {
            "verified": True,
            "domain": _serialize_domain(dom),
            "dns_details": dns_result.to_dict(),
        }

    except Exception as exc:
        logger.exception(f"Provider edge registration failed for {dom.domain}")
        dom.status = "routing_unknown"
        dom.error_message = f"DNS verified, but edge routing initialization encountered a temporary issue: {exc}"
        dom.updated_at = utc_now()
        session.add(dom)
        session.commit()
        session.refresh(dom)

        return {
            "verified": False,
            "status": dom.status,
            "ssl_status": dom.ssl_status,
            "error_message": dom.error_message,
            "dns_details": dns_result.to_dict(),
        }


@router.patch("/api/sites/{site_id}/domains/{domain_id}/primary")
def set_domain_primary(
    site_id: UUID,
    domain_id: UUID,
    request: Request,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Atomically marks a connected domain as the primary domain for the store.
    """
    try:
        target = set_primary_domain(site_id, domain_id, session)
    except DomainValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    actor = _get_admin_actor_context(ownership)
    ip_address, user_agent, req_id = extract_client_metadata(request)

    AuditService.log_event(
        site_id=site_id,
        actor_type=actor["actor_type"],
        actor_id=actor["actor_id"],
        actor_name=actor["actor_name"],
        actor_email=actor["actor_email"],
        actor_role=actor["actor_role"],
        category=AuditCategory.WEBSITE_STORE,
        action="domain.set_primary",
        source=SourceType.WEB_ADMIN,
        resource_type="site_domain",
        resource_id=str(target.id),
        resource_name=target.domain,
        summary=f"Set custom domain '{target.domain}' as primary store URL",
        metadata={"domain": target.domain},
        status="success",
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=req_id,
    )

    return _serialize_domain(target)


@router.delete("/api/sites/{site_id}/domains/{domain_id}")
def disconnect_domain(
    site_id: UUID,
    domain_id: UUID,
    request: Request,
    purge: bool = Query(default=True, description="Permanently delete domain record after deprovisioning"),
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Safely disconnects a custom domain:
    1. Demotes primary status.
    2. Deprovisions edge routing via provider.
    3. Either marks as disconnected or purges record.
    """
    dom = session.get(SiteDomain, domain_id)
    if not dom or dom.site_id != site_id:
        raise HTTPException(status_code=404, detail="Domain not found for this store.")

    domain_name = dom.domain
    dom.status = "disconnecting"
    dom.is_primary = False
    session.add(dom)
    session.commit()

    # Deprovision edge provider
    provider = get_domain_provider()
    try:
        provider.remove_custom_domain(domain_name)
    except Exception as e:
        logger.warning(f"Error while deprovisioning domain '{domain_name}' from edge provider: {e}")

    actor = _get_admin_actor_context(ownership)
    ip_address, user_agent, req_id = extract_client_metadata(request)

    if purge:
        session.delete(dom)
    else:
        dom.status = "disconnected"
        dom.ssl_status = "ssl_pending"
        dom.updated_at = utc_now()
        session.add(dom)

    session.commit()

    AuditService.log_event(
        site_id=site_id,
        actor_type=actor["actor_type"],
        actor_id=actor["actor_id"],
        actor_name=actor["actor_name"],
        actor_email=actor["actor_email"],
        actor_role=actor["actor_role"],
        category=AuditCategory.WEBSITE_STORE,
        action="domain.disconnected",
        source=SourceType.WEB_ADMIN,
        resource_type="site_domain",
        resource_id=str(domain_id),
        resource_name=domain_name,
        summary=f"Disconnected custom domain '{domain_name}'",
        metadata={"domain": domain_name, "purged": purge},
        status="success",
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=req_id,
    )

    return {
        "success": True,
        "message": f"Domain '{domain_name}' successfully disconnected.",
        "domain_id": str(domain_id),
    }


# ---------------------------------------------------------------------------
# 3. SUBNAME / SLUG MODIFICATION (WITH 90-DAY HOLD)
# ---------------------------------------------------------------------------

@router.post("/api/sites/{site_id}/change-slug")
def change_store_slug(
    site_id: UUID,
    payload: ChangeSlugRequest,
    request: Request,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    """
    Updates the Webcreon subdomain slug for a store.
    Enforces 90-day anti-squatting hold on the previous slug to prevent hijacking.
    """
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    try:
        new_slug = validate_and_normalize_slug(payload.new_slug)
    except DomainValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    old_slug = site.slug

    if new_slug == old_slug:
        return {
            "site_id": str(site.id),
            "slug": site.slug,
            "webcreon_url": f"https://{site.slug}.{PLATFORM_BASE_DOMAIN}",
            "message": "Subdomain is already set to this slug.",
        }

    # Availability & cooldown check
    available, err_msg = check_slug_availability(new_slug, site_id, session)
    if not available:
        raise HTTPException(status_code=409, detail=err_msg)

    now = utc_now()
    cooldown_until = now + timedelta(days=SLUG_HOLD_DAYS)

    # Record 90-day anti-squatting hold for the old slug
    if old_slug:
        # Check if already in history
        hist = session.exec(
            select(SiteSlugHistory).where(SiteSlugHistory.old_slug == old_slug)
        ).first()
        if hist:
            hist.reserved_until = cooldown_until
            hist.site_id = site.id
            session.add(hist)
        else:
            new_hist = SiteSlugHistory(
                site_id=site.id,
                old_slug=old_slug,
                reserved_until=cooldown_until,
            )
            session.add(new_hist)

    site.slug = new_slug
    if hasattr(site, "updated_at"):
        site.updated_at = now
    session.add(site)
    session.commit()
    session.refresh(site)

    # Invalidate provider edge cache if applicable
    provider = get_domain_provider()
    try:
        provider.purge_edge_cache(f"{old_slug}.{PLATFORM_BASE_DOMAIN}")
    except Exception:
        pass

    actor = _get_admin_actor_context(ownership)
    ip_address, user_agent, req_id = extract_client_metadata(request)

    AuditService.log_event(
        site_id=site_id,
        actor_type=actor["actor_type"],
        actor_id=actor["actor_id"],
        actor_name=actor["actor_name"],
        actor_email=actor["actor_email"],
        actor_role=actor["actor_role"],
        category=AuditCategory.WEBSITE_STORE,
        action="subdomain.slug_changed",
        source=SourceType.WEB_ADMIN,
        resource_type="site",
        resource_id=str(site.id),
        resource_name=site.name,
        summary=f"Changed Webcreon subdomain from '{old_slug}' to '{new_slug}'",
        metadata={
            "old_slug": old_slug,
            "new_slug": new_slug,
            "reserved_until": cooldown_until.isoformat(),
        },
        status="success",
        ip_address=ip_address,
        user_agent=user_agent,
        request_id=req_id,
    )

    return {
        "site_id": str(site.id),
        "slug": site.slug,
        "webcreon_subdomain": f"{site.slug}.{PLATFORM_BASE_DOMAIN}",
        "webcreon_url": f"https://{site.slug}.{PLATFORM_BASE_DOMAIN}",
        "old_slug": old_slug,
        "hold_days": SLUG_HOLD_DAYS,
        "cooldown_until": cooldown_until.isoformat(),
    }


# ---------------------------------------------------------------------------
# 4. PUBLIC EDGE ROUTING RESOLVER
# ---------------------------------------------------------------------------

@router.get("/api/public/domains/resolve")
def resolve_edge_domain(
    hostname: str = Query(..., description="Incoming HTTP Host header"),
    session: Session = Depends(get_session),
):
    """
    Public resolution endpoint used by reverse proxies / edge routers.
    Maps an incoming hostname to the corresponding published store.
    """
    if not hostname:
        raise HTTPException(status_code=400, detail="Missing hostname parameter")

    clean_host = hostname.strip().lower().split(":")[0].rstrip(".")

    # 1. Check if it matches Webcreon platform subdomain (<slug>.webcreon.in)
    if clean_host.endswith(f".{PLATFORM_BASE_DOMAIN}"):
        subdomain_part = clean_host[:-len(f".{PLATFORM_BASE_DOMAIN}")]
        site = session.exec(
            select(Site).where(Site.slug == subdomain_part)
        ).first()

        if site:
            return {
                "matched": True,
                "site_id": str(site.id),
                "slug": site.slug,
                "site_name": site.name,
                "is_published": site.is_published,
                "is_online": getattr(site, "is_online", True),
                "routing_type": "webcreon_subdomain",
                "custom_domain": None,
                "canonical_url": f"https://{site.slug}.{PLATFORM_BASE_DOMAIN}",
            }

    # 2. Check custom domain registry
    dom = session.exec(
        select(SiteDomain).where(
            SiteDomain.domain == clean_host,
            SiteDomain.status == "connected",
        )
    ).first()

    if dom:
        site = session.get(Site, dom.site_id)
        if site:
            return {
                "matched": True,
                "site_id": str(site.id),
                "slug": site.slug,
                "site_name": site.name,
                "is_published": site.is_published,
                "is_online": getattr(site, "is_online", True),
                "routing_type": "custom_domain",
                "custom_domain": dom.domain,
                "is_primary": dom.is_primary,
                "canonical_url": f"https://{dom.domain}",
            }

    return {
        "matched": False,
        "hostname": clean_host,
        "error": "No active store matching this domain was found.",
    }


# ---------------------------------------------------------------------------
# 5. DURABLE WEBHOOK HANDLER
# ---------------------------------------------------------------------------

@router.post("/api/webhooks/domain-edge")
async def handle_domain_edge_webhook(
    request: Request,
    session: Session = Depends(get_session),
):
    """
    Idempotent, deduplicated webhook handler for domain edge CDN notifications.
    """
    body_bytes = await request.body()
    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_id = str(payload.get("event_id") or payload.get("id") or "")
    provider = str(payload.get("provider") or "generic_edge")

    if not event_id:
        # Generate stable event hash if not explicitly provided by provider
        event_id = hashlib.sha256(body_bytes).hexdigest()[:32]

    # Check for deduplication
    existing_event = session.exec(
        select(ProcessedProviderEvent).where(
            ProcessedProviderEvent.provider == provider,
            ProcessedProviderEvent.event_id == event_id,
        )
    ).first()

    if existing_event:
        return {"status": "already_processed", "event_id": event_id}

    # Record event
    prov_event = ProcessedProviderEvent(
        provider=provider,
        event_id=event_id,
        resource_id=payload.get("domain") or payload.get("hostname"),
        payload_hash=hashlib.sha256(body_bytes).hexdigest(),
        status="processed",
    )
    session.add(prov_event)

    # Process status updates if domain is present
    domain_name = payload.get("domain") or payload.get("hostname")
    if domain_name:
        dom = session.exec(
            select(SiteDomain).where(SiteDomain.domain == domain_name.lower())
        ).first()
        if dom:
            new_routing_status = payload.get("routing_status")
            new_ssl_status = payload.get("ssl_status")
            if new_routing_status:
                dom.status = new_routing_status
            if new_ssl_status:
                dom.ssl_status = new_ssl_status
            dom.updated_at = utc_now()
            session.add(dom)

    session.commit()

    return {"status": "processed", "event_id": event_id}
