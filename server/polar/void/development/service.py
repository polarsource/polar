from dataclasses import dataclass
from uuid import UUID

from polar.config import settings
from polar.exceptions import PolarError
from polar.models import Account, Organization, User, UserOrganization
from polar.models.organization import STATUS_CAPABILITIES, OrganizationStatus
from polar.models.user_organization import OrganizationRole
from polar.postgres import AsyncSession
from polar.user.service import user as user_service
from polar.user_organization.repository import UserOrganizationRepository

from .repository import DevelopmentRepository


@dataclass(frozen=True)
class SeededOrganization:
    id: UUID
    slug: str
    name: str
    account_id: UUID
    operator_email: str
    invoice_prefix: str


VOID_DEVELOPMENT = SeededOrganization(
    id=UUID("053c646b-b21c-4b30-a2f5-125adfd68508"),
    slug="void-development",
    name="Void development",
    account_id=UUID("b7ee8011-c378-4e35-83c1-bc45e9b1ca8a"),
    operator_email="void@polar.sh",
    invoice_prefix="VOIDDEV",
)

PO_BOT = SeededOrganization(
    id=UUID("c3672707-4e4b-4b55-b00e-c61084274d54"),
    slug="po-bot",
    name="Po Bot",
    account_id=UUID("f4f352f6-a336-465c-ab48-e2a8415aa9a1"),
    operator_email="po-bot@polar.sh",
    invoice_prefix="POBOT",
)

SEEDED_ORGANIZATIONS = (VOID_DEVELOPMENT, PO_BOT)
SEEDED_SLUGS = frozenset(organization.slug for organization in SEEDED_ORGANIZATIONS)

ORGANIZATION_SLUG = VOID_DEVELOPMENT.slug
ORGANIZATION_ID = VOID_DEVELOPMENT.id
ACCOUNT_ID = VOID_DEVELOPMENT.account_id
OPERATOR_EMAIL = VOID_DEVELOPMENT.operator_email


class DevelopmentSeedConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "The reserved Void development organization or account already exists "
            "with incompatible identifiers or state. No existing records were changed.",
            409,
        )


class DevelopmentService:
    async def seed(
        self,
        session: AsyncSession,
        target: SeededOrganization = VOID_DEVELOPMENT,
    ) -> tuple[Organization, bool]:
        if not (settings.is_development() or settings.is_testing()):
            raise ValueError("Void seeding is only available in development or testing")
        repository = DevelopmentRepository.from_session(session)
        await repository.lock_seed()
        organizations = await repository.organizations(target.id, target.slug)
        account = await repository.account(target.account_id)
        if organizations:
            organization = organizations[0]
            if (
                len(organizations) != 1
                or organization.id != target.id
                or organization.slug != target.slug
                or organization.account_id != target.account_id
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
            await self.ensure_operator(
                session, organization, email=target.operator_email
            )
            return organization, False
        if account is not None:
            raise DevelopmentSeedConflict()
        organization = Organization(
            id=target.id,
            slug=target.slug,
            name=target.name,
            customer_invoice_prefix=target.invoice_prefix,
            account=Account(
                id=target.account_id, currency="usd", processor_fees_applicable=True
            ),
            status=OrganizationStatus.ACTIVE,
            capabilities={**STATUS_CAPABILITIES[OrganizationStatus.ACTIVE]},
            feature_settings={"void_enabled": True},
        )
        await repository.create(organization, flush=True)
        await self.ensure_operator(session, organization, email=target.operator_email)
        return organization, True

    async def seed_all(self, session: AsyncSession) -> bool:
        created = False
        for target in SEEDED_ORGANIZATIONS:
            _, target_created = await self.seed(session, target)
            created = created or target_created
        return created

    async def ensure_operator(
        self,
        session: AsyncSession,
        organization: Organization,
        email: str = OPERATOR_EMAIL,
    ) -> User:
        user, _ = await user_service.get_by_email_or_create(
            session=session, email=email
        )
        repository = UserOrganizationRepository.from_session(session)
        membership = await repository.get_by_user_and_organization(
            user.id, organization.id
        )
        if membership is None:
            session.add(
                UserOrganization(
                    user=user,
                    organization=organization,
                    role=OrganizationRole.admin,
                )
            )
            await session.flush()
        return user


development = DevelopmentService()
