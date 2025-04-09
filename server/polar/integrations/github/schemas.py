import time
from typing import Any

from pydantic import model_validator

from polar.kit.schemas import Schema


class OAuthAccessToken(Schema):
    access_token: str
    expires_in: int
    expires_at: int
    refresh_token: str
    refresh_token_expires_in: int
    refresh_token_expires_at: int

    @model_validator(mode="before")
    def set_refresh_token_expires_at(cls, data: dict[str, Any]) -> dict[str, Any]:
        epoch_now = int(time.time())
        expires_in = data["refresh_token_expires_in"]
        data["refresh_token_expires_at"] = epoch_now + expires_in
        return data
