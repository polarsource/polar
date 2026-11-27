from polar.base import PolarError


class PolarOutpostError(PolarError): ...


class NotReadyError(PolarOutpostError):
    """A read Outpost cannot answer yet: Polar has not sent the customer's snapshot
    in time."""


class UnavailableRedisError(PolarOutpostError):
    def __init__(self) -> None:
        super().__init__("Redis is unavailable")
