from polar.kit.email import unalias_email
from polar.models import Customer, Organization, Product, TrialRedemption
from polar.postgres import AsyncSession
from polar.trial_redemption.repository import TrialRedemptionRepository


class TrialRedemptionService:
    async def check_trial_already_redeemed(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        customer: Customer,
        product: Product | None = None,
        payment_method_fingerprint: str | None = None,
    ) -> bool:
        if customer.email is None:
            return False

        repository = TrialRedemptionRepository.from_session(session)
        trial_redemptions = await repository.get_all_by_organization_and_hints(
            organization.id,
            customer_email=unalias_email(customer.email),
            product=product.id if product else None,
            payment_method_fingerprint=payment_method_fingerprint,
        )
        return len(trial_redemptions) > 0

    async def create_trial_redemption(
        self,
        session: AsyncSession,
        *,
        customer: Customer,
        product: Product | None = None,
        payment_method_fingerprint: str | None = None,
    ) -> TrialRedemption | None:
        if customer.email is None:
            return None

        repository = TrialRedemptionRepository.from_session(session)
        return await repository.create(
            TrialRedemption(
                customer_email=unalias_email(customer.email),
                customer=customer,
                product=product,
                payment_method_fingerprint=payment_method_fingerprint,
            )
        )


trial_redemption = TrialRedemptionService()
