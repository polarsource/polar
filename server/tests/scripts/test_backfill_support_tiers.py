import uuid
from typing import Any

from polar.v2026_04.outputs import BenefitGrant

from polar import deserialize
from polar.models.organization import SupportTier
from scripts.backfill_support_tiers import resolve_tiers

ORG_ID = uuid.UUID("00000000-0000-0000-0000-00000000000a")
_CUSTOMER_ID = "00000000-0000-0000-0000-000000000002"
_SCALE_BENEFIT_ID = "00000000-0000-0000-0000-0000000000b1"
_GROWTH_BENEFIT_ID = "00000000-0000-0000-0000-0000000000b2"


def _make_grant(*, benefit_id: str, external_id: str) -> BenefitGrant:
    return deserialize(
        {
            "created_at": "2026-01-01T00:00:00Z",
            "modified_at": None,
            "id": f"grant-{benefit_id}",
            "is_granted": True,
            "is_revoked": False,
            "subscription_id": "00000000-0000-0000-0000-000000000001",
            "order_id": None,
            "customer_id": _CUSTOMER_ID,
            "benefit_id": benefit_id,
            "customer": _customer_dict(external_id),
            "benefit": _benefit_dict(benefit_id),
            "properties": {},
        },
        BenefitGrant,
    )


def _customer_dict(external_id: str) -> dict[str, Any]:
    return {
        "id": _CUSTOMER_ID,
        "created_at": "2026-01-01T00:00:00Z",
        "modified_at": None,
        "metadata": {},
        "email": "c@example.com",
        "email_verified": True,
        "type": "individual",
        "name": "c",
        "billing_name": None,
        "billing_address": None,
        "tax_id": None,
        "organization_id": "00000000-0000-0000-0000-000000000099",
        "deleted_at": None,
        "avatar_url": "",
        "external_id": external_id,
    }


def _benefit_dict(benefit_id: str) -> dict[str, Any]:
    return {
        "id": benefit_id,
        "type": "custom",
        "created_at": "2026-01-01T00:00:00Z",
        "modified_at": None,
        "description": "",
        "selectable": True,
        "deletable": True,
        "is_deleted": False,
        "visibility": "public",
        "visibility_configurable": True,
        "organization_id": "00000000-0000-0000-0000-000000000099",
        "metadata": {"type": "support"},
        "properties": {"note": None},
    }


class TestResolveTiers:
    def test_resolves_single_grant(self) -> None:
        grant = _make_grant(benefit_id=_SCALE_BENEFIT_ID, external_id=str(ORG_ID))

        resolved, result = resolve_tiers(
            {_SCALE_BENEFIT_ID: SupportTier.scale}, [grant]
        )

        assert resolved == {ORG_ID: SupportTier.scale}
        assert result.errors == 0

    def test_flags_multiple_grants_as_error(self) -> None:
        grants = [
            _make_grant(benefit_id=_SCALE_BENEFIT_ID, external_id=str(ORG_ID)),
            _make_grant(benefit_id=_GROWTH_BENEFIT_ID, external_id=str(ORG_ID)),
        ]

        resolved, result = resolve_tiers(
            {
                _SCALE_BENEFIT_ID: SupportTier.scale,
                _GROWTH_BENEFIT_ID: SupportTier.growth,
            },
            grants,
        )

        assert resolved == {}
        assert result.errors == 1

    def test_skips_untiered_grant(self) -> None:
        grant = _make_grant(benefit_id=_SCALE_BENEFIT_ID, external_id=str(ORG_ID))

        resolved, result = resolve_tiers({_SCALE_BENEFIT_ID: None}, [grant])

        assert resolved == {}
        assert result.untiered_skipped == 1
        assert result.errors == 0
