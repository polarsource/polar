from uuid import UUID

from polar.exceptions import PolarError
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession


class DeclarativeConfigManaged(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "This organization manages its catalog as code. "
            "Change your config and run `polar config apply`.",
            403,
        )


async def assert_catalog_editable(
    session: AsyncReadSession, organization_id: UUID
) -> None:
    repository = OrganizationRepository.from_session(session)
    organization = await repository.get_by_id(organization_id)
    if organization is not None and organization.is_config_as_code_enabled:
        raise DeclarativeConfigManaged()
