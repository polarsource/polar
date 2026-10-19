import pytest
from pydantic import ValidationError

from polar.enums import SubscriptionProrationBehavior
from polar.kit.currency import PresentmentCurrency
from polar.models.organization import (
    OrganizationSubscriptionSettings,
    resolve_default_customer_email_settings,
)
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


class TestSlugMaxLength:
    def test_slug_at_max_length_allowed(self) -> None:
        slug = "a" * 64
        org = OrganizationCreate(name="Clean Name", slug=slug)
        assert org.slug == slug

    def test_slug_too_long_rejected(self) -> None:
        slug = "a" * 65
        with pytest.raises(ValidationError, match="at most 64 characters"):
            OrganizationCreate(name="Clean Name", slug=slug)


class TestResolveCustomerEmailSettings:
    def test_new_email_inherits_a_disabled_subscription_cycle(self) -> None:
        """Organizations predating the key have it absent; they shouldn't get a
        new customer email switched on behind their back."""
        resolved = resolve_default_customer_email_settings(
            {"order_confirmation": False, "subscription_cycled": False}
        )

        assert resolved["payment_method_expiration_reminder"] is False

    def test_new_email_inherits_an_enabled_subscription_cycle(self) -> None:
        resolved = resolve_default_customer_email_settings(
            {"subscription_cycled": True}
        )

        assert resolved["payment_method_expiration_reminder"] is True

    def test_stored_value_wins_over_inheritance(self) -> None:
        resolved = resolve_default_customer_email_settings(
            {
                "subscription_cycled": False,
                "payment_method_expiration_reminder": True,
            }
        )

        assert resolved["payment_method_expiration_reminder"] is True

    def test_falls_back_to_enabled_when_nothing_is_stored(self) -> None:
        resolved = resolve_default_customer_email_settings({})

        assert resolved["payment_method_expiration_reminder"] is True

    def test_other_missing_keys_still_default_to_enabled(self) -> None:
        resolved = resolve_default_customer_email_settings(
            {"subscription_cycled": False}
        )

        assert resolved["order_confirmation"] is True
