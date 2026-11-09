import json
import typing

from polar.config.meters import MeterSet, meter_config
from polar.{{ latest }}.inputs import Config as ConfigDict

Kind: typing.TypeAlias = typing.Literal["meter"]


class Config:
    """The billing config `polar config plan` and `polar config apply` read.

    Pass your `MeterSet` class; it compiles to the JSON the API accepts.
    """

    def __init__(self, *, meters: type[MeterSet] | None = None) -> None:
        self.data = _compile(meters)

    def to_dict(self) -> ConfigDict:
        return self.data

    def to_json(self) -> str:
        return json.dumps(self.data, indent=2) + "\n"


def _compile(meters: type[MeterSet] | None) -> ConfigDict:
    meter_definitions = meters.definitions() if meters else []
    for definition in meter_definitions:
        _check_name("meter", definition.id, definition.name, 3, None)
    config: dict[str, typing.Any] = {
        "meters": [meter_config(d) for d in meter_definitions]
    }
    return typing.cast(ConfigDict, config)


def _check_name(
    kind: Kind, external_id: str, name: str | None, minimum: int, maximum: int | None
) -> None:
    fits = minimum <= len(external_id) and (
        maximum is None or len(external_id) <= maximum
    )
    if name is not None or fits:
        return
    span = (
        f"shorter than {minimum}"
        if maximum is None
        else f"not between {minimum} and {maximum}"
    )
    raise ValueError(
        f'Provide a name for {kind} "{external_id}" because its attribute name is {span} characters.'
    )
