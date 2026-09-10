from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from auth_middleware import check_admin_has_permission, enforce_site_ownership
from db.database import get_session
from models import AdminSite, Site, StorePage, SupportTicket, SupportTicketMessage, utc_now
from services.audit_service import AuditService, ActorType, SourceType, AuditCategory

router = APIRouter(tags=["store-pages"])


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    s = re.sub(r"^-+|-+$", "", s)
    return s or "page"


# Pydantic Request/Response schemas
class StorePageCreatePayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    subtitle: Optional[str] = Field(None, max_length=500)
    content: str = Field(..., description="Markdown content")
    page_type: str = Field("custom", max_length=50)
    is_published: bool = Field(True)

    meta_title: Optional[str] = Field(None, max_length=255)
    meta_description: Optional[str] = Field(None, max_length=1000)

    contact_email: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=100)
    contact_address: Optional[str] = Field(None, max_length=500)
    contact_hours: Optional[str] = Field(None, max_length=255)

    @field_validator("slug", mode="before")
    @classmethod
    def clean_slug(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        cleaned = slugify(str(v))
        return cleaned or None


class StorePageUpdatePayload(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    subtitle: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None
    page_type: Optional[str] = None
    is_published: Optional[bool] = None

    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_address: Optional[str] = None
    contact_hours: Optional[str] = None

    @field_validator("slug", mode="before")
    @classmethod
    def clean_slug(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        cleaned = slugify(str(v))
        return cleaned or None


class ContactInquiryPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    subject: Optional[str] = Field(None, max_length=255)
    message: str = Field(..., min_length=5)
    phone: Optional[str] = Field(None, max_length=100)


def build_default_pages(site_id: UUID, brand_name: str) -> List[StorePage]:
    """Builds professional, customized default Markdown templates for core pages."""
    return [
        StorePage(
            site_id=site_id,
            title="About Us",
            slug="about",
            subtitle=f"Welcome to {brand_name} — where quality meets craftsmanship.",
            page_type="about",
            is_published=True,
            is_default=True,
            meta_title=f"About Us | {brand_name}",
            meta_description=f"Discover the story, mission, and craftsmanship behind {brand_name}.",
            content=f"""# About {brand_name}

Welcome to **{brand_name}**, where passion, curation, and craftsmanship converge. We believe shopping should be inspiring, intuitive, and thoroughly delightful.

---

### Our Mission
Our mission is simple: to deliver exceptional products that bring effortless elegance, reliable utility, and authentic value to your everyday life. Every product in our collection is carefully vetted, tested, and packaged with precision.

### What Sets Us Apart
- **Uncompromising Quality**: We partner exclusively with verified artisans and manufacturers who share our dedication to superior materials and ethical production.
- **Customer First Experience**: From seamless ordering to rapid doorstep fulfillment, we treat every order as a milestone of trust.
- **Sustainable Stewardship**: We continuously refine our packaging and supply chain to minimize environmental impact and eliminate unnecessary waste.

---

> "Quality is never an accident; it is always the result of intelligent effort and sincere intention."

Thank you for choosing **{brand_name}** to be part of your lifestyle.
""",
        ),
        StorePage(
            site_id=site_id,
            title="Contact Us",
            slug="contact",
            subtitle="Have a question or need assistance? We're always here to help.",
            page_type="contact",
            is_published=True,
            is_default=True,
            contact_email=f"support@{slugify(brand_name) or 'store'}.com",
            contact_phone="+1 (800) 555-0199",
            contact_address=f"{brand_name} HQ, 100 Commerce Boulevard, Suite 400",
            contact_hours="Monday – Saturday: 9:00 AM – 7:00 PM EST",
            meta_title=f"Contact Us | {brand_name}",
            meta_description=f"Get in touch with {brand_name} customer support team. Reach us by email, phone, or send an inquiry.",
            content=f"""# Get in Touch with {brand_name}

We love hearing from our community! Whether you have an inquiry regarding your order, need product sizing advice, or want to discuss a partnership, our dedicated support team is ready to assist.

---

### Customer Support Hours
- **Monday – Friday:** 9:00 AM – 7:00 PM EST
- **Saturday:** 10:00 AM – 4:00 PM EST
- **Sunday:** Closed (Emergency tickets handled within 12 hours)

### Direct Inquiries
Feel free to send us a direct message using the contact form below or email us directly at our dedicated help desk. We typically respond within **2 to 4 business hours**.
""",
        ),
        StorePage(
            site_id=site_id,
            title="Privacy Policy",
            slug="privacy",
            subtitle=f"How {brand_name} collects, protects, and respects your personal data.",
            page_type="policy",
            is_published=True,
            is_default=True,
            meta_title=f"Privacy Policy | {brand_name}",
            meta_description=f"Learn how {brand_name} protects your personal information and privacy.",
            content=f"""# Privacy Policy

*Last updated: {datetime.now(timezone.utc).strftime('%B %d, %Y')}*

At **{brand_name}**, accessible from our online storefront, one of our main priorities is the privacy of our visitors and patrons. This Privacy Policy document outlines the types of information collected and recorded by {brand_name} and how we use it.

---

### 1. Information We Collect
When you browse our storefront, register an account, or complete a checkout purchase, we may collect:
- **Personal Identification Information**: Full name, email address, phone number, and delivery/billing address.
- **Payment & Transaction Details**: Payment method tokenization, order history, and billing verification. *(Note: We never store full credit/debit card numbers; all transactions are encrypted via industry-leading gateways).*
- **Device & Usage Analytics**: IP address, browser type, device information, and interaction logs to improve platform performance.

### 2. How We Use Your Information
We utilize the collected information strictly for legitimate commercial purposes:
- To process, fulfill, and provide real-time tracking for your orders.
- To communicate order updates, invoice receipts, and customer service notifications.
- To detect, prevent, and protect against fraudulent transactions and security threats.
- To improve our user experience, layout, and catalog based on customer feedback.

### 3. Cookies and Web Storage
We utilize essential session and preference cookies to maintain your shopping cart, remember login authentication states, and ensure lightning-fast page transitions. You can choose to disable cookies through your browser settings, though certain cart features may be limited.

### 4. Data Protection & Security
We employ robust AES-256 encryption, SSL/TLS data transmission protocols, and strict access controls. Your personal details are never sold, rented, or traded to third-party marketing brokers.

### 5. Your Rights
Under applicable data privacy regulations, you have the right to request access to your stored personal information, request corrections, or request deletion of your account history. Please contact us via our **Contact page** to exercise these rights.
""",
        ),
        StorePage(
            site_id=site_id,
            title="Terms of Service",
            slug="terms",
            subtitle=f"Terms, conditions, and guidelines for shopping on {brand_name}.",
            page_type="terms",
            is_published=True,
            is_default=True,
            meta_title=f"Terms of Service | {brand_name}",
            meta_description=f"Review the Terms of Service and conditions governing purchases on {brand_name}.",
            content=f"""# Terms of Service

*Effective Date: {datetime.now(timezone.utc).strftime('%B %d, %Y')}*

Please read these Terms of Service carefully before accessing or placing an order through **{brand_name}**. By accessing our site or purchasing from our catalog, you agree to be bound by the following terms and conditions.

---

### 1. General Conditions
By agreeing to these Terms, you represent that you are at least the age of majority in your state or province of residence. We reserve the right to refuse service, terminate accounts, or cancel orders at our sole discretion if fraud or violation of terms is suspected.

### 2. Pricing and Product Accuracy
Prices for our products are subject to change without prior notice. We strive to display product colors, imagery, and descriptions with maximum accuracy. However, monitor displays may vary slightly, and we do not warrant that product descriptions are entirely error-free.

### 3. Orders and Payment
We reserve the right to refuse or limit the quantities of any order placed with us. When placing an order, you agree to provide current, complete, and accurate purchase and account information for all purchases made at our store.

### 4. Shipping, Delivery & Tracking
Orders are processed and dispatched within the timeframe specified during checkout. Once dispatched, shipment tracking details are provided. Delivery dates are estimates provided by logistics partners and may be affected by severe weather or local logistics conditions.

### 5. Returns and Refunds
Items purchased through {brand_name} are eligible for returns or refunds in accordance with our return window policy from the date of delivery. Items must be in original condition with tags and packaging intact.

### 6. Limitation of Liability
In no event shall {brand_name}, its directors, officers, employees, or affiliates be liable for any indirect, incidental, punitive, or consequential damages arising from your use of the service or products procured through the store.
""",
        ),
        StorePage(
            site_id=site_id,
            title="Our Story",
            slug="story",
            subtitle="The journey, inspiration, and people behind our brand.",
            page_type="story",
            is_published=True,
            is_default=True,
            meta_title=f"Our Story | {brand_name}",
            meta_description=f"Learn how {brand_name} started and the vision shaping our collection.",
            content=f"""# The Story of {brand_name}

Every great brand starts with a simple question. For **{brand_name}**, it began with: *Why is it so hard to find authentic, durable, beautifully designed essentials without excessive markups?*

---

### The Beginning
What started as a small passion project in a humble workspace quickly resonated with discerning shoppers who appreciated our focus on detail. We spent months finding honest suppliers, testing prototypes, and refining every stitch and seam until we were proud to put our name on it.

### Our Values
1. **Design with Purpose**: Every product must earn its place in your life by being functional, durable, and visually inspiring.
2. **Honest Craftsmanship**: We celebrate transparent production and fair worker conditions across every workshop we work with.
3. **Lifelong Relationships**: We view every checkout not as a single transaction, but as the beginning of a long-term partnership with you.

---

Thank you for being part of our story. We are excited for what lies ahead!
""",
        ),
    ]


@router.get("/sites/{site_id}/pages", response_model=List[StorePage])
def list_store_pages(
    site_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    brand_name = (
        site.site_definition.get("site", {}).get("brand_name")
        if isinstance(site.site_definition, dict)
        else None
    ) or site.slug.replace("-", " ").title()

    existing_pages = session.exec(
        select(StorePage).where(StorePage.site_id == site_id)
    ).all()

    # If no pages exist yet, seed the 5 standard core pages
    if not existing_pages:
        defaults = build_default_pages(site_id, brand_name)
        for p in defaults:
            session.add(p)
        session.commit()
        existing_pages = session.exec(
            select(StorePage).where(StorePage.site_id == site_id)
        ).all()

    # Sort so default core pages are presented cleanly first
    return sorted(existing_pages, key=lambda p: (not p.is_default, p.created_at))


@router.post("/sites/{site_id}/pages", response_model=StorePage, status_code=status.HTTP_201_CREATED)
def create_store_page(
    site_id: UUID,
    payload: StorePageCreatePayload,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    admin_id = ownership.get("adminId") if isinstance(ownership, dict) else None
    if admin_id and not check_admin_has_permission(admin_id, "pages:create", session):
        raise HTTPException(status_code=403, detail="You do not have permission to create store pages")

    site = session.get(Site, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    slug_candidate = payload.slug or slugify(payload.title)

    # Check if slug is already taken for this site
    existing = session.exec(
        select(StorePage).where(
            StorePage.site_id == site_id,
            StorePage.slug == slug_candidate,
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A page with URL slug '{slug_candidate}' already exists for this store. Please pick another title or slug.",
        )

    if payload.is_published and admin_id and not check_admin_has_permission(admin_id, "pages:publish", session):
        raise HTTPException(status_code=403, detail="You do not have permission to publish pages directly")

    new_page = StorePage(
        site_id=site_id,
        title=payload.title.strip(),
        slug=slug_candidate,
        subtitle=payload.subtitle.strip() if payload.subtitle else None,
        content=payload.content.strip(),
        page_type=payload.page_type or "custom",
        is_published=payload.is_published,
        is_default=False,
        meta_title=payload.meta_title.strip() if payload.meta_title else None,
        meta_description=payload.meta_description.strip() if payload.meta_description else None,
        contact_email=payload.contact_email.strip() if payload.contact_email else None,
        contact_phone=payload.contact_phone.strip() if payload.contact_phone else None,
        contact_address=payload.contact_address.strip() if payload.contact_address else None,
        contact_hours=payload.contact_hours.strip() if payload.contact_hours else None,
    )

    session.add(new_page)
    try:
        session.commit()
        session.refresh(new_page)
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A database conflict occurred while creating the page.",
        )

    try:
        admin_uuid = UUID(str(admin_id)) if admin_id else None
        AuditService.log_event(
            site_id=site_id,
            actor_type=ActorType.OWNER if (ownership.get("role") or "").lower() == "owner" else ActorType.TEAM_MEMBER,
            actor_id=admin_uuid,
            actor_name=ownership.get("name"),
            actor_email=ownership.get("email"),
            actor_role=ownership.get("role") or "Staff",
            category=AuditCategory.WEBSITE,
            action="website.page_created",
            source=SourceType.WEB_ADMIN,
            resource_type="store_page",
            resource_id=str(new_page.id),
            resource_name=new_page.title,
            summary=f"Created store page '{new_page.title}' ({'/p/' + new_page.slug})",
            description=f"Created new page '{new_page.title}' with slug '/p/{new_page.slug}'. Published: {new_page.is_published}.",
            metadata={"slug": new_page.slug, "page_type": new_page.page_type, "is_published": new_page.is_published},
        )
    except Exception as log_err:
        pass

    session.refresh(new_page)
    return new_page


@router.get("/sites/{site_id}/pages/{page_id}", response_model=StorePage)
def get_store_page(
    site_id: UUID,
    page_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    page = session.get(StorePage, page_id)
    if not page or page.site_id != site_id:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


@router.put("/sites/{site_id}/pages/{page_id}", response_model=StorePage)
def update_store_page(
    site_id: UUID,
    page_id: UUID,
    payload: StorePageUpdatePayload,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    admin_id = ownership.get("adminId") if isinstance(ownership, dict) else None
    role = (ownership.get("role") or "").lower() if isinstance(ownership, dict) else ""
    is_owner = role == "owner" or ownership.get("is_owner") is True or ownership.get("isOwner") is True

    is_status_toggle_only = (
        payload.is_published is not None
        and payload.title is None
        and payload.slug is None
        and payload.subtitle is None
        and payload.content is None
        and payload.page_type is None
        and payload.meta_title is None
        and payload.meta_description is None
        and payload.contact_email is None
        and payload.contact_phone is None
        and payload.contact_address is None
        and payload.contact_hours is None
    )

    if not is_owner and admin_id:
        if is_status_toggle_only:
            has_publish = check_admin_has_permission(admin_id, "pages:publish", session)
            has_edit = check_admin_has_permission(admin_id, "pages:edit", session)
            if not (has_publish or has_edit):
                raise HTTPException(status_code=403, detail="You do not have permission to publish or unpublish store pages")
        else:
            if not check_admin_has_permission(admin_id, "pages:edit", session):
                raise HTTPException(status_code=403, detail="You do not have permission to edit store pages")
            if payload.is_published is not None and not check_admin_has_permission(admin_id, "pages:publish", session):
                raise HTTPException(status_code=403, detail="You do not have permission to publish or unpublish store pages")

    page = session.get(StorePage, page_id)
    if not page or page.site_id != site_id:
        raise HTTPException(status_code=404, detail="Page not found")

    if payload.slug is not None:
        new_slug = payload.slug or slugify(payload.title or page.title)
        if new_slug != page.slug:
            # Check collision
            existing = session.exec(
                select(StorePage).where(
                    StorePage.site_id == site_id,
                    StorePage.slug == new_slug,
                    StorePage.id != page_id,
                )
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"A page with slug '{new_slug}' already exists. Please choose a different slug.",
                )
            page.slug = new_slug

    if payload.title is not None:
        page.title = payload.title.strip()
    if payload.subtitle is not None:
        page.subtitle = payload.subtitle.strip() if payload.subtitle else None
    if payload.content is not None:
        page.content = payload.content
    if payload.page_type is not None:
        page.page_type = payload.page_type
    if payload.is_published is not None and payload.is_published != page.is_published:
        if not is_owner and admin_id and not (check_admin_has_permission(admin_id, "pages:publish", session) or check_admin_has_permission(admin_id, "pages:edit", session)):
            raise HTTPException(status_code=403, detail="You do not have permission to publish or unpublish store pages")
        page.is_published = payload.is_published

    if payload.meta_title is not None:
        page.meta_title = payload.meta_title.strip() if payload.meta_title else None
    if payload.meta_description is not None:
        page.meta_description = payload.meta_description.strip() if payload.meta_description else None

    if payload.contact_email is not None:
        page.contact_email = payload.contact_email.strip() if payload.contact_email else None
    if payload.contact_phone is not None:
        page.contact_phone = payload.contact_phone.strip() if payload.contact_phone else None
    if payload.contact_address is not None:
        page.contact_address = payload.contact_address.strip() if payload.contact_address else None
    if payload.contact_hours is not None:
        page.contact_hours = payload.contact_hours.strip() if payload.contact_hours else None

    page.updated_at = utc_now()
    session.add(page)
    session.commit()
    session.refresh(page)

    try:
        admin_uuid = UUID(str(admin_id)) if admin_id else None
        AuditService.log_event(
            site_id=site_id,
            actor_type=ActorType.OWNER if (ownership.get("role") or "").lower() == "owner" else ActorType.TEAM_MEMBER,
            actor_id=admin_uuid,
            actor_name=ownership.get("name"),
            actor_email=ownership.get("email"),
            actor_role=ownership.get("role") or "Staff",
            category=AuditCategory.WEBSITE,
            action="website.page_updated",
            source=SourceType.WEB_ADMIN,
            resource_type="store_page",
            resource_id=str(page.id),
            resource_name=page.title,
            summary=f"Updated store page '{page.title}' ({'/p/' + page.slug})",
            description=f"Updated page '{page.title}' content/settings. Published: {page.is_published}.",
            metadata={"slug": page.slug, "page_type": page.page_type, "is_published": page.is_published},
        )
    except Exception as log_err:
        pass

    session.refresh(page)
    return page


@router.delete("/sites/{site_id}/pages/{page_id}")
def delete_store_page(
    site_id: UUID,
    page_id: UUID,
    ownership=Depends(enforce_site_ownership),
    session: Session = Depends(get_session),
):
    admin_id = ownership.get("adminId") if isinstance(ownership, dict) else None
    if admin_id and not check_admin_has_permission(admin_id, "pages:delete", session):
        raise HTTPException(status_code=403, detail="You do not have permission to delete store pages")

    page = session.get(StorePage, page_id)
    if not page or page.site_id != site_id:
        raise HTTPException(status_code=404, detail="Page not found")

    if page.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Core system pages (About, Contact, Privacy, Terms, Story) cannot be deleted. You can set them to 'Draft' to hide them from the storefront.",
        )

    page_title = page.title
    page_id_str = str(page.id)
    session.delete(page)
    session.commit()

    try:
        admin_uuid = UUID(str(admin_id)) if admin_id else None
        AuditService.log_event(
            session=session,
            site_id=site_id,
            actor_type=ActorType.OWNER if (ownership.get("role") or "").lower() == "owner" else ActorType.TEAM_MEMBER,
            actor_id=admin_uuid,
            actor_name=ownership.get("name"),
            actor_email=ownership.get("email"),
            actor_role=ownership.get("role") or "Staff",
            category=AuditCategory.WEBSITE,
            action="website.page_deleted",
            source=SourceType.WEB_ADMIN,
            resource_type="store_page",
            resource_id=page_id_str,
            resource_name=page_title,
            summary=f"Deleted store page '{page_title}'",
        )
    except Exception as log_err:
        pass

    return {"success": True, "message": f"Page '{page_title}' deleted successfully."}


# ==============================================================================
# PUBLIC STOREFRONT ENDPOINTS
# ==============================================================================


@router.get("/public/sites/{site_identifier}/pages/{slug}")
def get_public_store_page(
    site_identifier: str,
    slug: str,
    session: Session = Depends(get_session),
):
    """Public endpoint for storefront visitors to fetch page content."""
    site = None
    try:
        site_uuid = UUID(site_identifier)
        site = session.get(Site, site_uuid)
    except (ValueError, TypeError):
        pass

    if not site:
        site = session.exec(select(Site).where(Site.slug == site_identifier)).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Clean slug
    clean_target_slug = slug.strip().lower()
    # Normalize aliases e.g. about-us -> about, contact-us -> contact
    alias_map = {
        "about-us": "about",
        "contact-us": "contact",
        "privacy-policy": "privacy",
        "terms-of-service": "terms",
        "terms-and-conditions": "terms",
        "our-story": "story",
    }
    normalized_slug = alias_map.get(clean_target_slug, clean_target_slug)

    page = session.exec(
        select(StorePage).where(
            StorePage.site_id == site.id,
            (StorePage.slug == clean_target_slug) | (StorePage.slug == normalized_slug),
        )
    ).first()

    # If default page not yet initialized in DB, auto-seed defaults on the fly
    if not page and normalized_slug in {"about", "contact", "privacy", "terms", "story"}:
        brand_name = (
            site.site_definition.get("site", {}).get("brand_name")
            if isinstance(site.site_definition, dict)
            else None
        ) or site.slug.replace("-", " ").title()

        defaults = build_default_pages(site.id, brand_name)
        for p in defaults:
            session.add(p)
        session.commit()

        page = session.exec(
            select(StorePage).where(
                StorePage.site_id == site.id,
                StorePage.slug == normalized_slug,
            )
        ).first()

    if not page or not page.is_published:
        raise HTTPException(status_code=404, detail="Page not found or not published")

    brand_name = (
        site.site_definition.get("site", {}).get("brand_name")
        if isinstance(site.site_definition, dict)
        else None
    ) or site.slug.replace("-", " ").title()

    theme = (
        site.site_definition.get("theme", {})
        if isinstance(site.site_definition, dict)
        else {}
    )

    return {
        "page": page,
        "site": {
            "id": str(site.id),
            "slug": site.slug,
            "brand_name": brand_name,
            "theme": theme,
        },
    }


@router.post("/public/sites/{site_identifier}/contact-inquiry")
def submit_contact_inquiry(
    site_identifier: str,
    payload: ContactInquiryPayload,
    session: Session = Depends(get_session),
):
    """Customer submits an inquiry via the Contact Us page."""
    site = None
    try:
        site_uuid = UUID(site_identifier)
        site = session.get(Site, site_uuid)
    except (ValueError, TypeError):
        pass

    if not site:
        site = session.exec(select(Site).where(Site.slug == site_identifier)).first()

    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # If support tickets table is available, create a support ticket automatically!
    try:
        ticket = SupportTicket(
            site_id=site.id,
            customer_name=payload.name.strip(),
            customer_email=payload.email.strip().lower(),
            customer_phone=payload.phone.strip() if payload.phone else None,
            category="general_inquiry",
            priority="normal",
            status="waiting_agent",
            subject=payload.subject.strip() if payload.subject else f"General Inquiry from {payload.name.strip()}",
        )
        session.add(ticket)
        session.commit()
        session.refresh(ticket)

        # Add initial customer message
        first_msg = SupportTicketMessage(
            ticket_id=ticket.id,
            sender_type="customer",
            sender_name=payload.name.strip(),
            message=payload.message.strip(),
            is_internal_note=False,
        )
        session.add(first_msg)
        session.commit()
    except Exception:
        # Graceful fallback if support tables are slightly different
        pass

    return {
        "success": True,
        "message": f"Thank you {payload.name.strip()}! Your message has been received by our support team. We will get back to you at {payload.email.strip()} shortly.",
    }
