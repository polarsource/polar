from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

import stripe.error as stripe_lib_error
import structlog

from polar.enums import AccountType
from polar.exceptions import PolarError
from polar.integrations.open_collective.service import (
    CollectiveNotFoundError,
    OpenCollectiveAPIError,
    open_collective,
)
from polar.integrations.stripe.service import stripe
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.services import ResourceService
from polar.models.account import Account
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession
from polar.user.service import user as user_service

from .schemas import AccountCreate, AccountLink, AccountUpdate

log = structlog.get_logger()


class AccountServiceError(PolarError):
    pass


class AccountAlreadyExistsError(AccountServiceError):
    def __init__(self) -> None:
        super().__init__("An account already exists for this organization.")


class AccountService(ResourceService[Account, AccountCreate, AccountUpdate]):
    async def get_by_org(
        self, session: AsyncSession, organization_id: UUID
    ) -> Account | None:
        return await self.get_by(session=session, organization_id=organization_id)

    async def get_by_user(self, session: AsyncSession, user_id: UUID) -> Account | None:
        return await self.get_by(session=session, user_id=user_id)

    async def get_by_stripe_id(
        self, session: AsyncSession, stripe_id: str
    ) -> Account | None:
        return await self.get_by(session=session, stripe_id=stripe_id)

    async def list_by(
        self,
        session: AsyncSession,
        *,
        org_id: UUID | None,
        user_id: UUID | None,
    ) -> Sequence[Account]:
        statement = sql.select(Account).where(Account.deleted_at.is_(None))

        if org_id:
            statement = statement.where(Account.organization_id == org_id)

        if user_id:
            statement = statement.where(Account.user_id == user_id)

        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def create_account(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID | None = None,
        user_id: UUID | None = None,
        admin_id: UUID,
        account: AccountCreate,
    ) -> Account:
        if organization_id and user_id:
            raise AccountServiceError(
                "both organization_id and user_id is set, this is not supported"
            )

        existing = await self.get_by(
            session=session, organization_id=organization_id, user_id=user_id
        )
        if existing is not None:
            raise AccountAlreadyExistsError()

        if account.account_type == AccountType.stripe:
            return await self._create_stripe_account(
                session,
                organization_id=organization_id,
                user_id=user_id,
                admin_id=admin_id,
                account=account,
            )
        elif account.account_type == AccountType.open_collective and organization_id:
            return await self._create_open_collective_account(
                session, organization_id, admin_id, account
            )

        raise AccountServiceError("Unknown account type")

    async def _build_stripe_account_name(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID | None,
        user_id: UUID | None,
    ) -> str | None:
        if organization_id:
            org = await organization_service.get(session, organization_id)
            if org:
                return f"github.com/{org.name} (org)"
        if user_id:
            user = await user_service.get(session, user_id)
            if user:
                return f"github.com/{user.username} (user)"
        return None

    async def _create_stripe_account(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID | None,
        user_id: UUID | None,
        admin_id: UUID,
        account: AccountCreate,
    ) -> Account:
        account_name = await self._build_stripe_account_name(
            session,
            organization_id=organization_id,
            user_id=user_id,
        )

        try:
            stripe_account = stripe.create_account(account, name=account_name)
        except stripe_lib_error.StripeError as e:
            if e.user_message:
                raise AccountServiceError(e.user_message) from e
            else:
                raise AccountServiceError("An unexpected Stripe error happened") from e

        return await Account.create(
            session=session,
            organization_id=organization_id,
            user_id=user_id,
            admin_id=admin_id,
            account_type=account.account_type,
            stripe_id=stripe_account.id,
            email=stripe_account.email,
            country=stripe_account.country,
            currency=stripe_account.default_currency,
            is_details_submitted=stripe_account.details_submitted,
            is_charges_enabled=stripe_account.charges_enabled,
            is_payouts_enabled=stripe_account.payouts_enabled,
            business_type=stripe_account.business_type,
            data=stripe_account.to_dict(),
        )

    async def _create_open_collective_account(
        self,
        session: AsyncSession,
        organization_id: UUID,
        admin_id: UUID,
        account: AccountCreate,
    ) -> Account:
        assert account.open_collective_slug is not None
        try:
            collective = await open_collective.get_collective(
                account.open_collective_slug
            )
        except OpenCollectiveAPIError as e:
            raise AccountServiceError(e.message) from e
        except CollectiveNotFoundError as e:
            raise AccountServiceError(e.message) from e

        if not collective.is_eligible:
            raise AccountServiceError(
                "This collective is not eligible to receive payouts. "
                "You can use Stripe instead."
            )

        return await Account.create(
            session=session,
            organization_id=organization_id,
            admin_id=admin_id,
            account_type=account.account_type,
            open_collective_slug=account.open_collective_slug,
            email=None,
            country=account.country,
            # For now, hard-code those values
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            business_type="fiscal_host",
            data={},
        )

    async def onboarding_link(self, account: Account) -> AccountLink | None:
        if account.account_type == AccountType.stripe:
            assert account.stripe_id is not None
            account_link = stripe.create_account_link(account.stripe_id)
            return AccountLink(url=account_link.url)

        return None

    async def dashboard_link(self, account: Account) -> AccountLink | None:
        if account.account_type == AccountType.stripe:
            assert account.stripe_id is not None
            account_link = stripe.create_login_link(account.stripe_id)
            return AccountLink(url=account_link.url)

        elif account.account_type == AccountType.open_collective:
            assert account.open_collective_slug is not None
            dashboard_link = open_collective.create_dashboard_link(
                account.open_collective_slug
            )
            return AccountLink(url=dashboard_link)

        return None

    def get_balance(
        self,
        account: Account,
    ) -> tuple[str, int] | None:
        if account.account_type != AccountType.stripe:
            return None
        assert account.stripe_id is not None
        return stripe.retrieve_balance(account.stripe_id)

    async def sync_to_upstream(self, session: AsyncSession, account: Account) -> None:
        name = await self._build_stripe_account_name(
            session, organization_id=account.organization_id, user_id=account.user_id
        )

        if account.account_type == AccountType.stripe and account.stripe_id:
            stripe.update_account(account.stripe_id, name)


account = AccountService(Account)
