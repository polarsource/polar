import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from polar.models import Organization


def sso_enforced_organization_ids(
    session: Session, organization_ids: set[uuid.UUID]
) -> set[uuid.UUID]:
    """Subset of ``organization_ids`` whose organizations enforce SSO.

    Used at token issuance to drop SSO-enforced orgs from the scope a non-SSO
    session can grant: such orgs are reachable only through an SSO-scoped session.
    """
    if not organization_ids:
        return set()
    statement = select(Organization.id).where(
        Organization.id.in_(organization_ids),
        Organization.sso_enforced.is_(True),
    )
    return set(session.execute(statement).scalars().all())
