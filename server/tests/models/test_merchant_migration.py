from typing import Any

import pytest

from polar.merchant_migration import pan_transfer
from polar.merchant_migration.pan_transfer import (
    STEP_STRIPE_COPY,
    PanStepStatus,
    PanTransferMethod,
)
from polar.models import (
    MerchantMigration,
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)


class TestSourceConnected:
    @pytest.mark.parametrize(
        ("step", "source_credentials", "expected"),
        [
            (MerchantMigrationStep.pre_check, {"api_key_encrypted": "x"}, True),
            (MerchantMigrationStep.pre_check, {"stripe_user_id": "acct_1"}, False),
            (MerchantMigrationStep.completed, {"stripe_user_id": "acct_1"}, True),
            (MerchantMigrationStep.closed, {"stripe_user_id": "acct_1"}, True),
        ],
    )
    def test_source_connected(
        self,
        step: MerchantMigrationStep,
        source_credentials: dict[str, Any],
        expected: bool,
    ) -> None:
        migration = MerchantMigration(
            source_platform=MerchantMigrationSourcePlatform.stripe,
            step=step,
            source_credentials=source_credentials,
        )

        assert migration.source_connected is expected


class TestExactCardMapping:
    @pytest.mark.parametrize(
        ("platform", "exact"),
        [
            (MerchantMigrationSourcePlatform.stripe, True),
            (MerchantMigrationSourcePlatform.lemon_squeezy, False),
        ],
    )
    def test_only_a_stripe_source_maps_cards_exactly(
        self, platform: MerchantMigrationSourcePlatform, exact: bool
    ) -> None:
        steps = pan_transfer.build(PanTransferMethod.pan_copy)
        for step in steps:
            if step.key == STEP_STRIPE_COPY:
                step.status = PanStepStatus.completed

        migration = MerchantMigration(
            source_platform=platform, pan_transfer_steps=steps
        )

        assert migration.exact_card_mapping is exact
