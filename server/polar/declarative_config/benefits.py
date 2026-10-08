from typing import Annotated, Any
from uuid import UUID

from pydantic import Discriminator, TypeAdapter

from polar.benefit.schemas import BenefitCreate, BenefitUpdate

from .schemas import ConfigBenefit, ConfigBenefitFeatureFlag, ConfigBenefitMeterCredit
from .validation import BenefitChange

_benefit_create_adapter: TypeAdapter[BenefitCreate] = TypeAdapter(BenefitCreate)
_benefit_update_adapter: TypeAdapter[BenefitUpdate] = TypeAdapter(
    Annotated[BenefitUpdate, Discriminator("type")]
)


def _properties(
    benefit_config: ConfigBenefit, meter_ids: dict[str, UUID]
) -> dict[str, Any]:
    if isinstance(benefit_config, ConfigBenefitFeatureFlag):
        return {}
    properties = benefit_config.properties.model_dump()
    if isinstance(benefit_config, ConfigBenefitMeterCredit):
        properties["meter_id"] = meter_ids[properties.pop("meter")]
    return properties


def benefit_create(
    benefit_config: ConfigBenefit,
    organization_id: UUID | None,
    meter_ids: dict[str, UUID],
) -> BenefitCreate:
    return _benefit_create_adapter.validate_python(
        {
            "type": benefit_config.type,
            "description": benefit_config.description,
            "visibility": benefit_config.visibility,
            "metadata": benefit_config.metadata,
            "organization_id": organization_id,
            "properties": _properties(benefit_config, meter_ids),
        }
    )


def benefit_update(change: BenefitChange, meter_ids: dict[str, UUID]) -> BenefitUpdate:
    update: dict[str, Any] = {
        "metadata" if name == "user_metadata" else name: value
        for name, value in change.update_dict.items()
        if name != "properties"
    }
    if "properties" in change.update_dict:
        update["properties"] = _properties(change.config, meter_ids)
    return _benefit_update_adapter.validate_python(
        {"type": change.config.type, **update}
    )
