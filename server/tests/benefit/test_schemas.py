import pytest
from pydantic import TypeAdapter

from polar.benefit.schemas import BenefitPublic
from polar.kit.visibility import Visibility
from polar.models import Meter, Organization
from polar.models.benefit import BenefitType
from polar.product.schemas import BenefitPublicList
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_benefit


@pytest.mark.asyncio
class TestBenefitPublic:
    async def test_meter_credit_properties(
        self, save_fixture: SaveFixture, organization: Organization, meter: Meter
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=BenefitType.meter_credit,
            properties={
                "units": 10000,
                "rollover": True,
                "meter_id": str(meter.id),
            },
        )

        adapter: TypeAdapter[BenefitPublic] = TypeAdapter(BenefitPublic)
        benefit_schema = adapter.validate_python(benefit)

        assert benefit_schema.id == benefit.id
        assert benefit_schema.type == BenefitType.meter_credit
        assert benefit_schema.properties.units == 10000
        assert not hasattr(benefit_schema.properties, "rollover")

    @pytest.mark.parametrize(
        "benefit_type",
        [t for t in BenefitType if t != BenefitType.meter_credit],
    )
    async def test_non_meter_credit_properties(
        self,
        save_fixture: SaveFixture,
        benefit_type: BenefitType,
        organization: Organization,
    ) -> None:
        benefit = await create_benefit(
            save_fixture,
            organization=organization,
            type=benefit_type,
        )

        adapter: TypeAdapter[BenefitPublic] = TypeAdapter(BenefitPublic)
        benefit_schema = adapter.validate_python(benefit)

        assert benefit_schema.id == benefit.id
        assert benefit_schema.type == benefit_type
        assert not hasattr(benefit_schema, "properties")


@pytest.mark.asyncio
class TestBenefitPublicList:
    async def test_excludes_non_public_benefits(
        self,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        public_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            description="Public benefit",
        )
        private_benefit = await create_benefit(
            save_fixture,
            organization=organization,
            description="Private benefit",
        )
        private_benefit.visibility = Visibility.private
        await save_fixture(private_benefit)

        adapter: TypeAdapter[BenefitPublicList] = TypeAdapter(BenefitPublicList)
        benefits = adapter.validate_python(
            [public_benefit, private_benefit], from_attributes=True
        )

        assert len(benefits) == 1
        assert benefits[0].description == "Public benefit"
