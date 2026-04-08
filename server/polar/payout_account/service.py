from __future__ import annotations

import uuid

import stripe as stripe_lib

from polar.auth.models import AuthSubject
from polar.enums import PayoutAccountType
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe
from polar.kit.db.postgres import AsyncReadSession
from polar.models import Organization, PayoutAccount, User
from polar.organization.repository import OrganizationRepository
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession

from .repository import PayoutAccountRepository
from .schemas import PayoutAccountCreate, PayoutAccountLink


class PayoutAccountServiceError(PolarError):
    pass


class PayoutAccountAlreadyExists(PayoutAccountServiceError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Organization {organization_id} already has a payout account"
        super().__init__(message, 409)


class PayoutAccountExternalIdDoesNotExist(PayoutAccountServiceError):
    def __init__(self, external_id: str) -> None:
        self.external_id = external_id
        message = f"Payout account with external ID {external_id} does not exist"
        super().__init__(message)


class PayoutAccountExternalLinkUnsupported(PayoutAccountServiceError):
    def __init__(self, account_type: PayoutAccountType) -> None:
        self.account_type = account_type
        message = f"Unsupported payout account type for external link: {account_type}"
        super().__init__(message, 404)


class PayoutAccountService:
    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User],
        payout_account_id: uuid.UUID,
    ) -> PayoutAccount | None:
        repository = PayoutAccountRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            PayoutAccount.id == payout_account_id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        payout_account_create: PayoutAccountCreate,
    ) -> PayoutAccount:
        organization = await get_payload_organization(
            session, auth_subject, payout_account_create
        )

        if organization.payout_account_id is not None:
            raise PayoutAccountAlreadyExists(organization.id)

        payout_account = await self._create_stripe_account(
            session,
            auth_subject.subject,
            payout_account_create.country,
            organization.name,
        )

        organization_repository = OrganizationRepository.from_session(session)
        organization.payout_account = payout_account
        await organization_repository.update(organization)

        return payout_account

    async def onboarding_link(
        self, payout_account: PayoutAccount, return_path: str
    ) -> PayoutAccountLink:
        match payout_account.type:
            case PayoutAccountType.stripe:
                assert payout_account.stripe_id is not None
                account_link = await stripe.create_account_link(
                    payout_account.stripe_id, return_path
                )
                return PayoutAccountLink(url=account_link.url)
            case _:
                raise PayoutAccountExternalLinkUnsupported(payout_account.type)

    async def dashboard_link(self, payout_account: PayoutAccount) -> PayoutAccountLink:
        match payout_account.type:
            case PayoutAccountType.stripe:
                assert payout_account.stripe_id is not None
                account_link = await stripe.create_login_link(payout_account.stripe_id)
                return PayoutAccountLink(url=account_link.url)
            case _:
                raise PayoutAccountExternalLinkUnsupported(payout_account.type)

    async def delete(
        self, session: AsyncSession, payout_account: PayoutAccount
    ) -> None:
        # Delete the account on Stripe
        if payout_account.type == PayoutAccountType.stripe:
            assert payout_account.stripe_id is not None
            # Verify the account exists on Stripe before deletion
            if not await stripe.account_exists(payout_account.stripe_id):
                raise PayoutAccountServiceError(
                    f"Stripe Account ID {payout_account.stripe_id} doesn't exist"
                )
            await stripe.delete_account(payout_account.stripe_id)

        repository = PayoutAccountRepository.from_session(session)
        await repository.soft_delete(payout_account)

    async def update_account_from_stripe(
        self, session: AsyncSession, *, stripe_account: stripe_lib.Account
    ) -> PayoutAccount:
        repository = PayoutAccountRepository.from_session(session)
        payout_account = await repository.get_by_stripe_id(stripe_account.id)
        if payout_account is None:
            raise PayoutAccountExternalIdDoesNotExist(stripe_account.id)

        payout_account.email = stripe_account.email
        assert stripe_account.default_currency is not None
        payout_account.currency = stripe_account.default_currency
        payout_account.is_details_submitted = stripe_account.details_submitted or False
        payout_account.is_charges_enabled = stripe_account.charges_enabled or False
        payout_account.is_payouts_enabled = stripe_account.payouts_enabled or False
        if stripe_account.country is not None:
            payout_account.country = stripe_account.country
        payout_account.data = stripe_account.to_dict()

        repository = PayoutAccountRepository.from_session(session)
        return await repository.update(payout_account)

    async def create_manual_account(
        self,
        session: AsyncSession,
        organization: Organization,
        admin: User,
        *,
        country: str,
        currency: str,
    ) -> PayoutAccount:
        repository = PayoutAccountRepository.from_session(session)
        payout_account = await repository.create(
            PayoutAccount(
                type=PayoutAccountType.manual,
                admin=admin,
                country=country,
                currency=currency,
            )
        )

        organization_repository = OrganizationRepository.from_session(session)
        organization.payout_account = payout_account
        await organization_repository.update(organization)

        return payout_account

    async def _create_stripe_account(
        self, session: AsyncSession, admin: User, country: str, name: str
    ) -> PayoutAccount:
        try:
            stripe_account = await stripe.create_account(country, name=name)
        except stripe_lib.StripeError as e:
            if e.user_message:
                raise PayoutAccountServiceError(e.user_message) from e
            else:
                raise PayoutAccountServiceError(
                    "An unexpected Stripe error happened"
                ) from e

        repository = PayoutAccountRepository.from_session(session)
        return await repository.create(
            PayoutAccount(
                type=PayoutAccountType.stripe,
                admin=admin,
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
        )


payout_account = PayoutAccountService()
