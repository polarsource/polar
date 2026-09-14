from polar.email.schemas import EmailTemplate
from polar.merchant_migration.repository import MerchantMigrationRecordRepository
from polar.models import Subscription
from polar.models.merchant_migration import MerchantMigrationSourcePlatform
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession

BILLING_MIGRATION_NOTICE_TEMPLATES: frozenset[EmailTemplate] = frozenset(
    {
        EmailTemplate.subscription_renewal_reminder,
        EmailTemplate.subscription_cycled,
        EmailTemplate.subscription_cycled_after_trial,
        EmailTemplate.subscription_past_due,
    }
)


async def previous_billing_provider_for_notice(
    session: AsyncSession, subscription: Subscription, template: str
) -> str | None:
    records = MerchantMigrationRecordRepository.from_session(session)
    if not await records.has_moved_subscription(subscription.id):
        return None

    orders = OrderRepository.from_session(session)
    cycle_orders = await orders.count_subscription_cycle_orders(subscription.id)
    if template == EmailTemplate.subscription_renewal_reminder:
        if cycle_orders > 0:
            return None
    elif cycle_orders > 1:
        return None
    return MerchantMigrationSourcePlatform.stripe.label


def is_billing_migration_notice_template(template: str) -> bool:
    return template in BILLING_MIGRATION_NOTICE_TEMPLATES
