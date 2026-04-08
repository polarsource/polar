from enum import StrEnum


class MeterUnit(StrEnum):
    scalar = "scalar"
    tokens = "tokens"
    bytes = "bytes"
    seconds = "seconds"
    custom = "custom"

