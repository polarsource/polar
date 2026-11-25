from typing import Any

import pytest

from polar.merchant_migration.card_status import (
    MerchantMigrationCardStatus,
    card_status,
)


@pytest.mark.parametrize(
    ("method_metadata", "status"),
    [
        (None, MerchantMigrationCardStatus.no_card),
        (
            {"country": "US", "exp_year": 2099, "exp_month": 1},
            MerchantMigrationCardStatus.ready,
        ),
        ({"country": "US"}, MerchantMigrationCardStatus.ready),
        (
            {"country": "IN", "exp_year": 2099, "exp_month": 1},
            MerchantMigrationCardStatus.india_card,
        ),
        (
            {"country": "US", "exp_year": 2020, "exp_month": 6},
            MerchantMigrationCardStatus.expired_card,
        ),
    ],
)
def test_card_status(
    method_metadata: dict[str, Any] | None, status: MerchantMigrationCardStatus
) -> None:
    assert card_status(method_metadata) == status
