import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from polar_sdk.models import BenefitGrant
from pytest_mock import MockerFixture

from polar.models.organization import SupportTier
from scripts.backfill_support_tiers import resolve_support_tier

ORG_ID = uuid.UUID("00000000-0000-0000-0000-00000000000a")
_CUSTOMER_ID = "00000000-0000-0000-0000-000000000002"
_BENEFIT_ID = "00000000-0000-0000-0000-0000000000b1"

_CUSTOMER_DICT: dict[str, Any] = {
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
    "external_id": str(ORG_ID),
}


def _make_grant(*, metadata: dict[str, Any]) -> BenefitGrant:
    return BenefitGrant.model_validate(
        {
            "created_at": "2026-01-01T00:00:00Z",
            "modified_at": None,
            "id": "00000000-0000-0000-0000-0000000000a1",
            "is_granted": True,
            "is_revoked": False,
            "subscription_id": "00000000-0000-0000-0000-000000000001",
            "order_id": None,
            "customer_id": _CUSTOMER_ID,
            "benefit_id": _BENEFIT_ID,
            "customer": _CUSTOMER_DICT,
            "benefit": {
                "id": _BENEFIT_ID,
                "type": "custom",
                "created_at": "2026-01-01T00:00:00Z",
                "modified_at": None,
                "description": "",
                "selectable": True,
                "deletable": True,
                "is_deleted": False,
                "visibility": "public",
                "visibility_configurable": True,
                "organization_id": _CUSTOMER_DICT["organization_id"],
                "metadata": metadata,
                "properties": {"note": None},
            },
            "properties": {},
        }
    )


def _patch_client(
    mocker: MockerFixture,
    *,
    customer: object,
    grants: list[BenefitGrant] | None = None,
) -> None:
    client = MagicMock()
    client.get_customer_by_external_id_or_none = AsyncMock(return_value=customer)
    client.list_customer_benefit_grants = AsyncMock(return_value=grants or [])
    # resolve_support_tier resolves the customer through the script's client,
    # then defers to the service's _fetch_active_grant, which resolves grants
    # through the service module's client. Patch both to the same mock.
    mocker.patch("scripts.backfill_support_tiers.get_client", return_value=client)
    mocker.patch("polar.integrations.polar.service.get_client", return_value=client)


@pytest.mark.asyncio
class TestResolveSupportTier:
    async def test_no_customer_returns_none(self, mocker: MockerFixture) -> None:
        _patch_client(mocker, customer=None)

        assert await resolve_support_tier(ORG_ID) is None

    async def test_no_support_grant_returns_none(self, mocker: MockerFixture) -> None:
        _patch_client(mocker, customer=MagicMock(id=_CUSTOMER_ID), grants=[])

        assert await resolve_support_tier(ORG_ID) is None

    async def test_resolves_tier_from_active_grant(self, mocker: MockerFixture) -> None:
        grant = _make_grant(
            metadata={
                "type": "support",
                "level": "4",
                "slack": "false",
                "prioritized": "true",
                "plain_tier_external_id": "scale",
            }
        )
        _patch_client(mocker, customer=MagicMock(id=_CUSTOMER_ID), grants=[grant])

        assert await resolve_support_tier(ORG_ID) == SupportTier.scale
