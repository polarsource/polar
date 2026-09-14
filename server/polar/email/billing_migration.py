from polar.email.schemas import EmailTemplate
from polar.merchant_migration.repository import MerchantMigrationRecordRepository
from polar.models import MerchantMigrationSourcePlatform, Subscription
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession

PRE_BILLING_NOTICE_TEMPLATES: frozenset[EmailTemplate] = frozenset(
    {
        EmailTemplate.subscription_renewal_reminder,
        EmailTemplate.subscription_trial_conversion_reminder,
    }
)


async def previous_billing_provider_for_notice(
    session: AsyncSession, subscription: Subscription, template: EmailTemplate
) -> str | None:
    records = MerchantMigrationRecordRepository.from_session(session)
    if not await records.has_moved_subscription(subscription.id):
        return None

    orders = OrderRepository.from_session(session)
    polar_orders = await orders.count_subscription_cycle_orders(subscription.id)
    if (
        template in PRE_BILLING_NOTICE_TEMPLATES and polar_orders > 0
    ) or polar_orders > 1:
        return None
    return MerchantMigrationSourcePlatform.stripe.label
