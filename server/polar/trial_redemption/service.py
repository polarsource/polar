from email_validator.validate_email import validate_email

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
        repository = TrialRedemptionRepository.from_session(session)
        trial_redemptions = await repository.get_all_by_organization_and_hints(
            organization.id,
            customer_email=self._get_unaliased_email(customer.email),
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
    ) -> TrialRedemption:
        repository = TrialRedemptionRepository.from_session(session)
        return await repository.create(
            TrialRedemption(
                customer_email=self._get_unaliased_email(customer.email),
                customer=customer,
                product=product,
                payment_method_fingerprint=payment_method_fingerprint,
            )
        )

    def _get_unaliased_email(self, email: str) -> str:
        parsed_email = validate_email(email, check_deliverability=False)
        return f"{parsed_email.local_part.split('+', 1)[0]}@{parsed_email.domain}"


trial_redemption = TrialRedemptionService()
