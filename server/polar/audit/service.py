from __future__ import annotations

from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from polar.audit.context import AuditContext, AuditInfo
from polar.audit.enums import AuditAction, AuditActorType, AuditResourceType
from polar.models.audit_log import AuditLog

log = structlog.get_logger()


def compute_changes(
    model: Any,
    update_dict: dict[str, Any],
) -> dict[str, dict[str, Any]] | None:
    """Compare current model attribute values against an update dict.

    Must be called BEFORE any attribute mutations are applied to the model.

    For JSONB/dict fields, performs a deep diff recording only changed nested keys
    using dot-notation (e.g., "subscription_settings.proration_behavior").

    Returns {"field": {"old": ..., "new": ...}} or None if no changes detected.
    """
    changes: dict[str, dict[str, Any]] = {}

    for field, new_value in update_dict.items():
        old_value = getattr(model, field, None)

        if isinstance(old_value, dict) and isinstance(new_value, dict):
            nested = _diff_dicts(field, old_value, new_value)
            changes.update(nested)
        else:
            old_comparable = _normalize_value(old_value)
            new_comparable = _normalize_value(new_value)
            if old_comparable != new_comparable:
                changes[field] = {
                    "old": _serialize_value(old_value),
                    "new": _serialize_value(new_value),
                }

    return changes if changes else None


def _diff_dicts(
    prefix: str,
    old_dict: dict[str, Any],
    new_dict: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    """Recursively diff two dicts, returning dot-notation keys for changed values."""
    changes: dict[str, dict[str, Any]] = {}
    all_keys = set(old_dict.keys()) | set(new_dict.keys())

    for key in all_keys:
        full_key = f"{prefix}.{key}"
        old_val = old_dict.get(key)
        new_val = new_dict.get(key)

        if isinstance(old_val, dict) and isinstance(new_val, dict):
            changes.update(_diff_dicts(full_key, old_val, new_val))
        else:
            old_comparable = _normalize_value(old_val)
            new_comparable = _normalize_value(new_val)
            if old_comparable != new_comparable:
                changes[full_key] = {
                    "old": _serialize_value(old_val),
                    "new": _serialize_value(new_val),
                }

    return changes


def _normalize_value(value: Any) -> Any:
    """Normalize values for comparison (e.g., enums to their string value)."""
    if hasattr(value, "value"):
        return value.value
    return value


def _serialize_value(value: Any) -> Any:
    """Serialize a value for JSONB storage."""
    if value is None:
        return None
    if isinstance(value, UUID):
        return str(value)
    if hasattr(value, "value"):
        return value.value
    if isinstance(value, list):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: _serialize_value(v) for k, v in value.items()}
    return value


async def record(
    session: AsyncSession,
    organization_id: UUID,
    action: AuditAction,
    *,
    resource_type: AuditResourceType,
    resource_id: UUID,
    changes: dict[str, dict[str, Any]] | None = None,
    metadata: dict[str, Any] | None = None,
    actor_override: AuditInfo | None = None,
) -> AuditLog:
    """Record an audit log entry.

    Actor info is auto-resolved from AuditContext (set by middleware).
    Falls back to actor_type="system" when no context is available
    (e.g., in background tasks).

    Use actor_override to explicitly set actor info when the context
    doesn't reflect the real actor (rare).
    """
    ctx = actor_override or AuditContext.get()

    if ctx is not None:
        actor_type = ctx.actor_type
        actor_id = ctx.actor_id
        actor_name = ctx.actor_name
        ip_address = ctx.ip_address
    else:
        actor_type = AuditActorType.system
        actor_id = None
        actor_name = None
        ip_address = None

    audit_log = AuditLog(
        organization_id=organization_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        actor_type=actor_type,
        actor_id=actor_id,
        actor_name=actor_name,
        changes=changes,
        metadata_=metadata,
        ip_address=ip_address,
    )
    session.add(audit_log)

    log.info(
        "audit_log.recorded",
        audit_action=action,
        organization_id=str(organization_id),
        resource_type=resource_type,
        resource_id=str(resource_id),
        actor_type=actor_type,
        actor_id=str(actor_id) if actor_id else None,
    )

    return audit_log
