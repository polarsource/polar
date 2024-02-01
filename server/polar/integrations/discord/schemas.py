from typing import Any

from pydantic import field_validator
from pydantic_extra_types.color import Color

from polar.kit.schemas import Schema


class DiscordGuildRole(Schema):
    id: str
    name: str
    position: int
    is_polar_bot: bool
    color: Color

    @field_validator("color", mode="before")
    @classmethod
    def int_color_to_hex(cls, v: Any) -> str:
        if isinstance(v, int):
            return hex(v)[2:].zfill(6)
        return v


class DiscordGuild(Schema):
    name: str
    roles: list[DiscordGuildRole]
