import typing

from polar.config.meter import MeterSet


class Config:
    """The billing config of an organization.

    Assign it to a module-level variable named `config`.
    """

    def __init__(self, *, meters: type[MeterSet] | None = None) -> None:
        self.meters = meters

    def to_dict(self) -> dict[str, typing.Any]:
        meters = self.meters._entries() if self.meters else []
        return {"meters": [meter.to_dict(external_id) for external_id, meter in meters]}
