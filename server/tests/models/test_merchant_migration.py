from typing import Any

import pytest

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
