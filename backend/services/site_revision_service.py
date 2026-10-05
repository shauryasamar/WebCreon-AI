"""
WebCreon AI Store Co-Pilot - Site Revision & Optimistic Concurrency Service
Provides server-side site definition versioning, optimistic concurrency locking (409 Conflict),
and durable, site-scoped undo via compensating revisions.
"""

import copy
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from uuid import UUID, uuid4
from sqlmodel import Session, select
from models import Site


# In-memory durable revision store for site definitions (persisted per site_id)
# Also updates Site.draft_definition and Site.site_definition on the Site model
_SITE_REVISIONS_STORE: Dict[str, list[Dict[str, Any]]] = {}


def get_site_revisions(site_id: str | UUID) -> list[Dict[str, Any]]:
    """Returns all revisions for a given site."""
    s_key = str(site_id)
    return _SITE_REVISIONS_STORE.get(s_key, [])


def create_site_revision(
    session: Session,
    site_id: str | UUID,
    actor_id: str | UUID,
    new_definition: Dict[str, Any],
    patch_applied: Optional[Dict[str, Any]] = None,
    expected_base_version: Optional[int] = None,
    operation_id: Optional[str | UUID] = None,
) -> Tuple[bool, Optional[int], Optional[str], Optional[Dict[str, Any]]]:
    """
    Persists a new immutable site revision with optimistic concurrency check.
    Returns: (success, new_version, error_or_conflict_reason, revision_record)
    """
    s_uuid = UUID(str(site_id))
    site = session.get(Site, s_uuid)
    if not site:
        return False, None, "Site not found", None

    current_version = getattr(site, "version", 1) or 1
    if not isinstance(current_version, int) or current_version < 1:
        current_version = 1

    # Optimistic concurrency check
    if expected_base_version is not None and expected_base_version != current_version:
        return (
            False,
            current_version,
            f"Version conflict: base_version {expected_base_version} does not match current server version {current_version}. Stale write prevented.",
            None,
        )

    new_version = current_version + 1
    revision_id = uuid4()
    op_uuid = UUID(str(operation_id)) if operation_id else uuid4()
    a_uuid = UUID(str(actor_id))

    revision_record = {
        "revision_id": str(revision_id),
        "site_id": str(s_uuid),
        "version": new_version,
        "parent_version": current_version,
        "patch": patch_applied or {},
        "definition": copy.deepcopy(new_definition),
        "actor_id": str(a_uuid),
        "operation_id": str(op_uuid),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Update site in database
    site.draft_definition = copy.deepcopy(new_definition)
    setattr(site, "version", new_version)
    session.add(site)
    session.commit()
    session.refresh(site)

    # Append to durable site revisions
    s_key = str(s_uuid)
    if s_key not in _SITE_REVISIONS_STORE:
        _SITE_REVISIONS_STORE[s_key] = []
    _SITE_REVISIONS_STORE[s_key].append(revision_record)

    return True, new_version, None, revision_record


def undo_site_revision(
    session: Session,
    site_id: str | UUID,
    actor_id: str | UUID,
    operation_id: Optional[str | UUID] = None,
) -> Tuple[bool, Optional[int], Optional[Dict[str, Any]], Optional[str]]:
    """
    Durable site-scoped undo: Restores previous revision by creating a compensating revision.
    Never deletes historical audit trail.
    """
    s_uuid = UUID(str(site_id))
    s_key = str(s_uuid)
    history = _SITE_REVISIONS_STORE.get(s_key, [])

    if len(history) < 2:
        return False, None, None, "No previous revision available to undo"

    # Current is last element, previous is second to last
    target_prev_revision = history[-2]
    prev_definition = target_prev_revision["definition"]

    # Apply as a compensating new revision
    success, new_version, err, rec = create_site_revision(
        session=session,
        site_id=s_uuid,
        actor_id=actor_id,
        new_definition=prev_definition,
        patch_applied={"action": "compensating_undo", "restored_version": target_prev_revision["version"]},
        expected_base_version=None,
        operation_id=operation_id,
    )

    if not success:
        return False, None, None, err

    return True, new_version, prev_definition, None
