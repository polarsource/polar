import dataclasses
import typing

from polar.config.definitions import DefinitionSet, VisibleDefinition, definition_fields
from polar.config.meters import Meter
from polar.{{ latest }}.inputs import ConfigBenefit


@dataclasses.dataclass(frozen=True, kw_only=True)
class Benefit(VisibleDefinition):
    name: str | None = dataclasses.field(default=None, kw_only=False)

    def describe(self) -> str:
        return repr(self.name) if self.name else super().describe()


@dataclasses.dataclass(frozen=True, kw_only=True)
class Flag(Benefit):
    """A feature flag benefit. The name is shown to customers and defaults to the attribute name."""


@dataclasses.dataclass(frozen=True, kw_only=True)
class Credits(Benefit):
    """Meter credits: `units` credited on `meter` each cycle.

    With `rollover=True`, unused units carry over to the next cycle.
    """

    meter: Meter
    units: int
    rollover: bool = False


class BenefitSet(DefinitionSet[Benefit]):
    item = Benefit


def benefit_config(definition: Benefit) -> ConfigBenefit:
    config: dict[str, typing.Any] = {
        "external_id": definition.id,
        "description": definition.name
        if definition.name is not None
        else definition.id,
        **definition_fields(definition),
    }
    if isinstance(definition, Credits):
        config["type"] = "meter_credit"
        config["properties"] = {
            "meter": definition.meter.id,
            "units": definition.units,
            "rollover": definition.rollover,
        }
    else:
        config["type"] = "feature_flag"
    return typing.cast(ConfigBenefit, config)
