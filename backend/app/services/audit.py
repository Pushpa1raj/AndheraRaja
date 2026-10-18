from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def record_audit(
    db: Session,
    *,
    administrator_id: UUID,
    action: str,
    target_type: str,
    target_id: UUID,
    reason: str | None = None,
    previous_state: dict | None = None,
    new_state: dict | None = None,
) -> AuditLog:
    event = AuditLog(
        administrator_id=administrator_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        previous_state=previous_state,
        new_state=new_state,
    )
    db.add(event)
    return event
