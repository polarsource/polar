from typing import Any
from uuid import UUID

from polar.benefit.strategies.feature_flag.schemas import (
    BenefitFeatureFlagCreate,
    BenefitFeatureFlagCreateProperties,
    BenefitFeatureFlagUpdate,
)
from polar.benefit.strategies.meter_credit.schemas import (
    BenefitMeterCreditCreate,
    BenefitMeterCreditCreateProperties,
    BenefitMeterCreditUpdate,
)

from .schemas import ConfigBenefit, ConfigBenefitFeatureFlag, ConfigBenefitMeterCredit
from .validation import BenefitChange


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
            organization_id=organization_id,
            properties=BenefitMeterCreditCreateProperties(
                meter_id=meter_ids[properties.meter],
                units=properties.units,
                rollover=properties.rollover,
            ),
        )
    if not isinstance(benefit_config, ConfigBenefitFeatureFlag):
        raise NotImplementedError(benefit_config.type)
    return BenefitFeatureFlagCreate(
        type=benefit_config.type,
        description=benefit_config.description,
        metadata=benefit_config.metadata,
        organization_id=organization_id,
        properties=BenefitFeatureFlagCreateProperties(),
    )


def benefit_update(
    change: BenefitChange, meter_ids: dict[str, UUID]
) -> BenefitFeatureFlagUpdate | BenefitMeterCreditUpdate:
    update: dict[str, Any] = {
        "metadata" if name == "user_metadata" else name: value
        for name, value in change.update_dict.items()
        if name != "properties"
    }
    config = change.config
    if isinstance(config, ConfigBenefitMeterCredit):
        if "properties" in change.update_dict:
            update["properties"] = BenefitMeterCreditCreateProperties(
                meter_id=meter_ids[config.properties.meter],
                units=config.properties.units,
                rollover=config.properties.rollover,
            )
        return BenefitMeterCreditUpdate(type=config.type, **update)
    if not isinstance(config, ConfigBenefitFeatureFlag):
        raise NotImplementedError(config.type)
    return BenefitFeatureFlagUpdate(type=config.type, **update)
