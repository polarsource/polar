import contextlib
from collections.abc import Generator
from typing import Any, TypeAlias

from pydantic import AfterValidator, BaseModel, ValidationError
from pydantic.fields import FieldInfo
from pydantic_core import ErrorDetails
from tagflow import classes, tag, text
from tagflow.tagflow import AttrValue

Data: TypeAlias = dict[str, Any] | object


def _get_data_value(data: Data | None, key: str) -> Any | None:
    if data is None:
        return None
    if isinstance(data, dict):
        return data.get(key)
    return getattr(data, key, None)


def _get_field_errors(errors: list[ErrorDetails], key: str) -> list[ErrorDetails]:
    return [error for error in errors if error["loc"][0] == key]


class InputField:
    def __init__(self, type: str = "text") -> None:
        self.type = type

    @contextlib.contextmanager
    def render(
        self,
        id: str,
        label: str,
        *,
        required: bool = False,
        value: Any | None = None,
        errors: list[ErrorDetails] = [],
    ) -> Generator[None]:
        with tag.div(classes="flex flex-col"):
            with tag.label(classes="input w-full", **{"for": id}):
                if errors:
                    classes("input-error")
                with tag.span(classes="label"):
                    text(label)
                with tag.input(
                    id=id,
                    name=id,
                    type=self.type,
                    required=required,
                    value=str(value),
                ):
                    pass
            for error in errors:
                with tag.div(classes="validator-hint text-error"):
                    text(error["msg"])
        yield


class CurrencyField(InputField):
    def __init__(self) -> None:
        self.type = "number"

    @contextlib.contextmanager
    def render(
        self,
        id: str,
        label: str,
        *,
        required: bool = False,
        value: int | None = None,
        errors: list[ErrorDetails] = [],
    ) -> Generator[None]:
        formatted_value = value / 100 if value is not None else None
        with super().render(
            id,
            label,
            required=required,
            value=formatted_value,
            errors=errors,
        ):
            pass
        yield


def _get_input_field(field: FieldInfo) -> InputField:
    for meta in field.metadata:
        if isinstance(meta, InputField):
            return meta
    return InputField()


CurrencyValidator = AfterValidator(lambda x: x * 100)


class BaseForm(BaseModel):
    @classmethod
    @contextlib.contextmanager
    def render(
        cls,
        data: Data | None = None,
        validation_error: ValidationError | None = None,
        **kwargs: AttrValue,
    ) -> Generator[None]:
        errors = validation_error.errors() if validation_error else []
        with tag.form(**kwargs):
            for key, field in cls.model_fields.items():
                input_field = _get_input_field(field)
                with input_field.render(
                    key,
                    field.title or key,
                    required=field.is_required(),
                    value=_get_data_value(data, key),
                    errors=_get_field_errors(errors, key),
                ):
                    pass
            yield
