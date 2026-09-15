from uuid import UUID

from polar.config import settings
from polar.exceptions import PolarError
from polar.models import Account, Organization
from polar.models.organization import STATUS_CAPABILITIES, OrganizationStatus
from polar.postgres import AsyncSession

from .repository import DevelopmentRepository

ORGANIZATION_SLUG = "void-development"
ORGANIZATION_ID = UUID("053c646b-b21c-4b30-a2f5-125adfd68508")
ACCOUNT_ID = UUID("b7ee8011-c378-4e35-83c1-bc45e9b1ca8a")


class DevelopmentSeedConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "The reserved Void development organization or account already exists "
            "with incompatible identifiers or state. No existing records were changed.",
            409,
        )


class DevelopmentService:
    async def seed(self, session: AsyncSession) -> tuple[Organization, bool]:
        if not (settings.is_development() or settings.is_testing()):
            raise ValueError("Void seeding is only available in development or testing")
        repository = DevelopmentRepository.from_session(session)
        await repository.lock_seed()
        organizations = await repository.organizations(
            ORGANIZATION_ID, ORGANIZATION_SLUG
        )
        account = await repository.account(ACCOUNT_ID)
        if organizations:
            organization = organizations[0]
            if (
                len(organizations) != 1
                or organization.id != ORGANIZATION_ID
                or organization.slug != ORGANIZATION_SLUG
                or organization.account_id != ACCOUNT_ID
                or organization.deleted_at is not None
                or organization.status != OrganizationStatus.ACTIVE
                or not organization.can_authenticate
                or account is None
                or account.deleted_at is not None
                or account.currency != "usd"
            ):
                raise DevelopmentSeedConflict()
            organization.feature_settings = {
                **organization.feature_settings,
                "void_enabled": True,
            }
            await session.flush()
            return organization, False
        if account is not None:
            raise DevelopmentSeedConflict()
        organization = Organization(
            id=ORGANIZATION_ID,
            slug=ORGANIZATION_SLUG,
            name="Void development",
            customer_invoice_prefix="VOIDDEV",
            account=Account(
                id=ACCOUNT_ID, currency="usd", processor_fees_applicable=True
            ),
            status=OrganizationStatus.ACTIVE,
            capabilities={**STATUS_CAPABILITIES[OrganizationStatus.ACTIVE]},
            feature_settings={"void_enabled": True},
        )
        await repository.create(organization, flush=True)
        return organization, True


development = DevelopmentService()
