from typing import Any

from pydantic import BaseModel, field_validator


class DeletePayoutAccountForm(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Reason is required")
        return v

    @classmethod
    def model_validate_form(cls, data: Any) -> "DeletePayoutAccountForm":
        return cls.model_validate(dict(data))
