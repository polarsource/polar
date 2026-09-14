from polar.email.schemas import EmailTemplate
from polar.merchant_migration.repository import MerchantMigrationRecordRepository
from polar.models import Subscription
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
    session: AsyncSession, subscription: Subscription
) -> str | None:
    records = MerchantMigrationRecordRepository.from_session(session)
    platform = await records.get_moved_source_platform(subscription.id)
    if platform is None:
        return None
    return platform.label


def is_billing_migration_notice_template(template: str) -> bool:
    return template in BILLING_MIGRATION_NOTICE_TEMPLATES
