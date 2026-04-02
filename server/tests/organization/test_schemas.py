import pytest
from pydantic import ValidationError

from polar.enums import SubscriptionProrationBehavior
from polar.kit.currency import PresentmentCurrency
from polar.models.organization import OrganizationSubscriptionSettings
from polar.organization.schemas import OrganizationCreate


def test_cant_set_reset_proration_behavior() -> None:
    with pytest.raises(ValidationError):
        OrganizationCreate(
            name="Test Org",
            slug="test-org",
            email=None,
            website=None,
            socials=None,
            details=None,
            country=None,
            subscription_settings=OrganizationSubscriptionSettings(
                allow_multiple_subscriptions=True,
                proration_behavior=SubscriptionProrationBehavior.reset,  # type: ignore
                benefit_revocation_grace_period=1,
                prevent_trial_abuse=True,
                allow_customer_updates=True,
            ),
            default_presentment_currency=PresentmentCurrency.usd,
        )
