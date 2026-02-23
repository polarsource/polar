from typing import Protocol

from pydantic import UUID4
from sqlalchemy import select

from polar.auth.models import AuthSubject, is_organization
from polar.exceptions import PolarRequestValidationError
from polar.models import Organization, User, UserOrganization
from polar.postgres import AsyncSession


class _OrganizationIDModelNone(Protocol):
    organization_id: UUID4 | None


class _OrganizationIDModel(Protocol):
    organization_id: UUID4


OrganizationIDModel = _OrganizationIDModelNone | _OrganizationIDModel


async def get_payload_organization(
    session: AsyncSession,
    auth_subject: AuthSubject[User | Organization],
    model: OrganizationIDModel,
) -> Organization:
    # Avoids a circular import :(

    if is_organization(auth_subject):
        if model.organization_id is not None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "organization_token",
                        "msg": (
                            "Setting organization_id is disallowed "
                            "when using an organization token."
                        ),
                        "loc": (
                            "body",
                            "organization_id",
                        ),
                        "input": model.organization_id,
                    }
                ]
            )
        return auth_subject.subject

    if model.organization_id is None:
        raise PolarRequestValidationError(
            [
                {
                    "type": "missing",
                    "msg": "organization_id is required.",
                    "loc": (
                        "body",
                        "organization_id",
                    ),
                    "input": None,
                }
            ]
        )

    statement = select(Organization).where(
        Organization.id == model.organization_id,
        Organization.id.in_(
            select(UserOrganization.organization_id).where(
                UserOrganization.user_id == auth_subject.subject.id,
                UserOrganization.is_deleted.is_(False),
            )
        ),
    )
    result = await session.execute(statement)
    organization = result.scalar_one_or_none()

    if organization is None:
        raise PolarRequestValidationError(
            [
                {
                    "loc": (
                        "body",
                        "organization_id",
                    ),
                    "msg": "Organization not found.",
                    "type": "value_error",
                    "input": model.organization_id,
                }
            ]
        )

    return organization
