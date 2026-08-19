from typing import Any, Self

from pydantic import ConfigDict, RootModel, model_validator
from pydantic_core import PydanticCustomError

LABEL_MAX_LENGTH = 32


class UnitLabel(RootModel[dict[str, dict[str, str]]]):
    """Per-locale unit nouns.

    `{"en": {"=1": "seat", "other": "seats"}}`
    """

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [{"en": {"=1": "seat", "other": "seats"}}],
        }
    )

    @model_validator(mode="after")
    def validate_label(self) -> Self:
        if not self.root:
            raise PydanticCustomError(
                "empty_unit_label",
                "Unit label must include at least one locale",
            )
        cleaned: dict[str, dict[str, str]] = {}
        for locale, forms in self.root.items():
            cleaned[locale] = _clean_forms(forms)
        self.root = cleaned
        return self


def _clean_forms(forms: dict[str, Any]) -> dict[str, str]:
    cleaned: dict[str, str] = {}
    for key, value in forms.items():
        if not isinstance(value, str):
            raise PydanticCustomError(
                "unit_label_form_not_string",
                "Unit label form {key} must be a string",
                {"key": key},
            )
        stripped = value.strip()
        if not stripped:
            continue
        if len(stripped) > LABEL_MAX_LENGTH:
            raise PydanticCustomError(
                "unit_label_form_too_long",
                "Unit label forms must be at most {max_length} characters",
                {"max_length": LABEL_MAX_LENGTH},
            )
        cleaned[key] = stripped
    if "other" not in cleaned:
        raise PydanticCustomError(
            "missing_other_plural",
            "Each locale must include a non-empty 'other' form",
        )
    return cleaned
