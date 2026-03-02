from polar.kit.repository import RepositoryBase
from polar.models.subscription_reminder import SubscriptionReminder


class SubscriptionReminderRepository(RepositoryBase[SubscriptionReminder]):
    model = SubscriptionReminder
