"""
WebCreon AI Store Co-Pilot - Typed Multi-Action Plan & Deterministic Validator
Provides strict Pydantic action models, deterministic risk evaluation, and reference resolution.
"""

from typing import Dict, Any, List, Optional, Literal
from uuid import UUID, uuid4
from pydantic import BaseModel, Field


ActionKind = Literal[
    "design_change",
    "banner_create",
    "analytics_query",
    "order_status_change",
    "seo_audit",
    "knowledge_query",
]

ActionRisk = Literal[
    "read_only",
    "reversible_draft_write",
    "customer_visible_write",
    "financial_or_fulfilment_write",
    "destructive_or_security_write",
]


class PlannedAction(BaseModel):
    action_id: UUID = Field(default_factory=uuid4)
    kind: ActionKind
    target_type: Optional[str] = None  # e.g., 'hero_banner', 'navbar', 'product_card', 'order', 'store'
    target_id: Optional[str] = None    # e.g., component_id or order_id
    arguments: Dict[str, Any] = Field(default_factory=dict)
    depends_on: List[UUID] = Field(default_factory=list)
    risk: ActionRisk = "read_only"
    needs_confirmation: bool = False
    explanation: str = ""


class ActionPlan(BaseModel):
    actions: List[PlannedAction] = Field(default_factory=list)
    needs_clarification: bool = False
    clarification_question: Optional[str] = None


class ActionResult(BaseModel):
    action_id: UUID
    kind: str
    status: Literal["succeeded", "failed", "skipped", "needs_confirmation"]
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    new_version: Optional[int] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    safe_message: str = ""
    error: Optional[str] = None


def calculate_deterministic_risk(kind: ActionKind, arguments: Dict[str, Any]) -> tuple[ActionRisk, bool]:
    """Deterministically computes action risk and confirmation requirement."""
    if kind in ("analytics_query", "seo_audit", "knowledge_query"):
        return "read_only", False

    if kind in ("design_change", "banner_create"):
        # Reversible draft changes do not require blocking confirmation
        return "reversible_draft_write", False

    if kind == "order_status_change":
        new_status = str(arguments.get("new_status", "")).lower()
        if new_status in ("cancelled", "canceled"):
            return "financial_or_fulfilment_write", True
        return "customer_visible_write", False

    return "destructive_or_security_write", True


def resolve_component_target(
    requested_target: Optional[str],
    site_definition: Dict[str, Any],
    selected_component_id: Optional[str] = None,
    last_created_receipt: Optional[Dict[str, Any]] = None,
) -> tuple[Optional[str], Optional[str]]:
    """
    Deterministically resolves a target component within the active site definition.
    Resolution Order:
    1. Explicit matching component_id in site_definition
    2. Selected UI component
    3. Last-created component from thread receipts
    4. Unique component matching type in site_definition
    5. None (requires clarification)
    """
    pages = site_definition.get("pages", [])
    blocks = []
    for p in pages:
        for b in p.get("blocks", []):
            blocks.append(b)

    if not requested_target and selected_component_id:
        # Check if selected component exists
        for b in blocks:
            if b.get("id") == selected_component_id:
                return b.get("id"), b.get("type")

    # If user referred to "banner created now" or "last created"
    if requested_target in ("last_created", "banner_created_now", "created_banner"):
        if last_created_receipt and last_created_receipt.get("component_id"):
            comp_id = last_created_receipt.get("component_id")
            for b in blocks:
                if b.get("id") == comp_id:
                    return comp_id, b.get("type")

    # Match by ID or exact block type
    target_clean = (requested_target or "").lower().strip()
    matching_blocks = []
    for b in blocks:
        b_id = str(b.get("id", "")).lower()
        b_type = str(b.get("type", "")).lower()
        if target_clean and (target_clean == b_id or target_clean in b_id):
            return b.get("id"), b.get("type")
        if target_clean in ("hero", "banner", "hero_banner") and "hero" in b_type:
            matching_blocks.append(b)
        elif target_clean in ("nav", "navbar", "header") and ("nav" in b_type or "header" in b_type):
            matching_blocks.append(b)
        elif target_clean in ("product", "products", "grid", "cards") and ("product" in b_type or "grid" in b_type):
            matching_blocks.append(b)
        elif target_clean in ("footer",) and "footer" in b_type:
            matching_blocks.append(b)

    if len(matching_blocks) == 1:
        return matching_blocks[0].get("id"), matching_blocks[0].get("type")
    elif len(matching_blocks) > 1:
        # If UI selection matches one of them, pick UI selection
        if selected_component_id:
            for b in matching_blocks:
                if b.get("id") == selected_component_id:
                    return b.get("id"), b.get("type")
        # Default to first one or ask clarification
        return matching_blocks[0].get("id"), matching_blocks[0].get("type")

    return None, None


def validate_and_refine_action_plan(
    plan: ActionPlan,
    site_id: str | UUID,
    site_definition: Dict[str, Any],
    selected_component_id: Optional[str] = None,
    last_created_receipt: Optional[Dict[str, Any]] = None,
) -> ActionPlan:
    """
    Validates proposed action plan against deterministic business rules and safety invariants.
    """
    if not plan or not plan.actions:
        return plan

    # Maximum 5 actions per single request
    validated_actions: List[PlannedAction] = []
    for action in plan.actions[:5]:
        # Enforce server-side calculated risk
        risk, needs_conf = calculate_deterministic_risk(action.kind, action.arguments)
        action.risk = risk
        action.needs_confirmation = needs_conf

        # Validate and resolve target component for design actions
        if action.kind in ("design_change", "banner_create"):
            comp_id, comp_type = resolve_component_target(
                requested_target=action.target_id or action.target_type,
                site_definition=site_definition,
                selected_component_id=selected_component_id,
                last_created_receipt=last_created_receipt,
            )
            if comp_id:
                action.target_id = comp_id
                action.target_type = comp_type
            elif action.kind == "design_change" and not action.arguments.get("global_theme"):
                # If target cannot be resolved and not a global theme change, ask for clarification
                pass

        validated_actions.append(action)

    plan.actions = validated_actions
    return plan
