import pytest
from pydantic import ValidationError

from polar.enums import SubscriptionProrationBehavior
from polar.kit.currency import PresentmentCurrency
from polar.models.organization import OrganizationSubscriptionSettings
from polar.organization.schemas import OrganizationCreate, OrganizationUpdate


def test_reset_proration_behavior_accepted_in_schema() -> None:
    org = OrganizationCreate(
        name="Test Org",
        slug="test-org",
        email=None,
        website=None,
        socials=None,
        details=None,
        country=None,
        subscription_settings=OrganizationSubscriptionSettings(
            allow_multiple_subscriptions=True,
            proration_behavior=SubscriptionProrationBehavior.reset,
            benefit_revocation_grace_period=1,
            prevent_trial_abuse=True,
            allow_customer_updates=True,
        ),
        default_presentment_currency=PresentmentCurrency.usd,
    )
    assert org.subscription_settings is not None
    assert (
        org.subscription_settings["proration_behavior"]
        == SubscriptionProrationBehavior.reset
    )


class TestBlockedWords:
    @pytest.mark.parametrize(
        "name",
        [
            "Porn Hub",
            "Sex Shop",
            "NSFW Art",
            "xxx studio",
            "SeX",
            "PORN",
        ],
    )
    def test_blocked_name_on_create(self, name: str) -> None:
        with pytest.raises(ValidationError, match="not allowed"):
            OrganizationCreate(name=name, slug="clean-slug")

    @pytest.mark.parametrize(
        "slug",
        [
            "porn-shop",
            "sex-shop",
            "nsfw-art",
            "xxx-studio",
        ],
    )
    def test_blocked_slug_on_create(self, slug: str) -> None:
        with pytest.raises(ValidationError, match="not allowed"):
            OrganizationCreate(name="Clean Name", slug=slug)

    @pytest.mark.parametrize(
        "name",
        [
            "Porn Hub",
            "Sex Shop",
            "NSFW Art",
        ],
    )
    def test_blocked_name_on_update(self, name: str) -> None:
        with pytest.raises(ValidationError, match="not allowed"):
            OrganizationUpdate(name=name)

    @pytest.mark.parametrize(
        "name",
        [
            "Essex County",
            "Middlesex Corp",
            "Sextant Navigation",
            "Acme Inc",
        ],
    )
    def test_allows_substring_matches(self, name: str) -> None:
        org = OrganizationCreate(name=name, slug="clean-slug")
        assert org.name == name

    def test_update_without_name_skips_validation(self) -> None:
        org = OrganizationUpdate(name=None)
        assert org.name is None
