import uuid

from authlib.oauth2.rfc6749.errors import InvalidRequestError
from sqlalchemy.orm import Session

from polar.authz.repository import select_user_org_ids
from polar.models import User

from ..requests import StarletteOAuth2Payload


def validate_down_scope_organizations(
    session: Session, payload: StarletteOAuth2Payload, user: User
) -> list[uuid.UUID]:
    """Parse and validate the `organizations` down-scope from a grant request.

    Returns the organization IDs the issued token should be restricted to —
    each validated against the user's membership. Empty means unrestricted.
    """
    raw_organizations = payload.datalist.get("organizations", [])
    if not raw_organizations:
        return []

    try:
        organization_ids = [uuid.UUID(value) for value in raw_organizations]
    except ValueError as e:
        raise InvalidRequestError("Invalid 'organizations' UUID") from e

    member_organization_ids = set(
        session.execute(select_user_org_ids(user.id)).scalars().all()
    )
    for organization_id in organization_ids:
        if organization_id not in member_organization_ids:
            raise InvalidRequestError(
                f"You are not a member of organization {organization_id}"
            )

    return organization_ids
