from uuid import UUID

from polar.benefit.strategies.feature_flag.schemas import (
    BenefitFeatureFlagCreate,
    BenefitFeatureFlagCreateProperties,
)
from polar.benefit.strategies.meter_credit.schemas import (
    BenefitMeterCreditCreate,
    BenefitMeterCreditCreateProperties,
)

from .schemas import ConfigBenefit, ConfigBenefitMeterCredit


def benefit_create(
    benefit_config: ConfigBenefit,
    organization_id: UUID | None,
    meter_ids: dict[str, UUID],
) -> BenefitFeatureFlagCreate | BenefitMeterCreditCreate:
    if isinstance(benefit_config, ConfigBenefitMeterCredit):
        properties = benefit_config.properties
        return BenefitMeterCreditCreate(
            type=benefit_config.type,
            description=benefit_config.description,
            metadata=benefit_config.metadata,
            visibility=benefit_config.visibility,
            organization_id=organization_id,
            properties=BenefitMeterCreditCreateProperties(
                meter_id=meter_ids[properties.meter],
                units=properties.units,
                rollover=properties.rollover,
            ),
        )
    return BenefitFeatureFlagCreate(
        type=benefit_config.type,
        description=benefit_config.description,
        metadata=benefit_config.metadata,
        visibility=benefit_config.visibility,
        organization_id=organization_id,
        properties=BenefitFeatureFlagCreateProperties(),
    )
