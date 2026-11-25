import pytest

from polar.kit.utils import utc_now
from polar.merchant_migration.benefits import kept_key_properties
from polar.models import Customer, Organization
from polar.models.benefit import BenefitType
from polar.models.license_key import LicenseKey, LicenseKeyStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit


@pytest.mark.anyio
class TestKeptKeyProperties:
    @pytest.mark.parametrize(
        ("taken", "deleted", "expected"),
        [
            (False, False, {"user_provided_key": "KEY-1"}),
            (True, False, {}),
            (True, True, {}),
        ],
    )
    async def test_reuses_a_key_only_while_its_value_is_free(
        self,
        taken: bool,
        deleted: bool,
        expected: dict[str, str],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
    ) -> None:
        if taken:
            benefit = await create_benefit(
                save_fixture, organization=organization, type=BenefitType.license_keys
            )
            await save_fixture(
                LicenseKey(
                    organization_id=organization.id,
                    customer_id=customer.id,
                    benefit_id=benefit.id,
                    key="KEY-1",
                    status=LicenseKeyStatus.granted,
                    deleted_at=utc_now() if deleted else None,
                )
            )

        properties = await kept_key_properties(session, organization.id, "KEY-1")

        assert dict(properties) == expected
