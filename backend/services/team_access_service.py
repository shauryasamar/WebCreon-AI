from typing import List, Optional
from uuid import UUID

from sqlmodel import Session, select
from models import (
    AdminSite,
    SubscriptionPlan,
    WebsiteSubscription,
    WebsiteTeamMember,
    utc_now,
)

MAX_PRO_TEAM_MEMBERS = 10


def is_team_feature_available(session: Session, website_id: UUID) -> bool:
    """Team members and roles functionality is an exclusive feature of the PRO plan."""
    sub = session.exec(
        select(WebsiteSubscription).where(WebsiteSubscription.website_id == website_id)
    ).first()
    if not sub:
        return False
    return sub.plan == SubscriptionPlan.PRO.value and sub.status in ("ACTIVE", "GRACE_PERIOD")


def deactivate_all_team_members(session: Session, website_id: UUID) -> int:
    """
    On downgrade from Pro to Free or Starter:
    Deactivates team members for this website (sets is_active=False).
    Records are fully preserved; only active permissions are revoked.
    """
    members = session.exec(
        select(WebsiteTeamMember).where(
            WebsiteTeamMember.website_id == website_id,
            WebsiteTeamMember.is_active == True,
        )
    ).all()

    deactivated = 0
    now = utc_now()
    for member in members:
        if member.role != "OWNER":
            member.is_active = False
            member.updated_at = now
            session.add(member)
            deactivated += 1

    session.commit()
    return deactivated


def reactivate_team_members(session: Session, website_id: UUID) -> int:
    """
    On re-upgrade to Pro:
    Restores up to 10 previously active team members with their prior roles.
    """
    members = session.exec(
        select(WebsiteTeamMember).where(
            WebsiteTeamMember.website_id == website_id,
            WebsiteTeamMember.is_active == False,
        ).order_by(WebsiteTeamMember.created_at.asc()).limit(MAX_PRO_TEAM_MEMBERS)
    ).all()

    reactivated = 0
    now = utc_now()
    for member in members:
        member.is_active = True
        member.updated_at = now
        session.add(member)
        reactivated += 1

    session.commit()
    return reactivated
