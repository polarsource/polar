from enum import StrEnum


class MeterUnit(StrEnum):
    scalar = "scalar"
    tokens = "token"
    custom = "custom"
