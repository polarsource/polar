import contextlib
from collections.abc import Generator
from enum import StrEnum
from inspect import isclass
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


class FormField:
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
        raise NotImplementedError()


class SkipField: ...


class InputField(FormField):
    def __init__(self, type: str = "text", **kwargs: Any) -> None:
        self.type = type
        self.kwargs = kwargs

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
                    value=str(value) if value is not None else "",
                    **self.kwargs,
                ):
                    pass
            for error in errors:
                with tag.div(classes="validator-hint text-error"):
                    text(error["msg"])
        yield


class CheckboxField(FormField):
    def __init__(self, **kwargs: Any) -> None:
        self.kwargs = kwargs

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
            with tag.label(classes="label", **{"for": id}):
                with tag.input(
                    id=id,
                    name=id,
                    type="checkbox",
                    required=required,
                    checked=value,
                    classes="checkbox",
                    **self.kwargs,
                ):
                    pass
                text(label)
            for error in errors:
                with tag.div(classes="validator-hint text-error"):
                    text(error["msg"])
        yield


class CurrencyField(InputField):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__("number", **kwargs)

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


class SelectField(FormField):
    def __init__(
        self,
        options: list[tuple[str, str]],
        placeholder: str = "Select an option",
        **kwargs: Any,
    ) -> None:
        self.options = options
        self.placeholder = placeholder
        self.kwargs = kwargs

    @contextlib.contextmanager
    def render(
        self,
        id: str,
        label: str,
        *,
        required: bool = False,
        value: str | None = None,
        errors: list[ErrorDetails] = [],
    ) -> Generator[None]:
        with tag.div(classes="flex flex-col"):
            with tag.label(classes="select w-full", **{"for": id}):
                if errors:
                    classes("select-error")
                with tag.span(classes="label"):
                    text(label)
                with tag.select(
                    id=id,
                    name=id,
                    required=required,
                    **self.kwargs,
                ):
                    with tag.option(value="", selected=value is None):
                        text(self.placeholder)
                    for option_value, option_label in self.options:
                        selected = value == option_value if value is not None else False
                        with tag.option(value=option_value, selected=selected):
                            text(option_label)
            for error in errors:
                with tag.div(classes="validator-hint text-error"):
                    text(error["msg"])
        yield


def _is_skipped_field(field: FieldInfo) -> bool:
    for meta in field.metadata:
        if meta is SkipField or isinstance(meta, SkipField):
            return True
    return False


def _get_input_field(field: FieldInfo) -> FormField:
    for meta in field.metadata:
        if isinstance(meta, FormField):
            return meta

    if field.annotation:
        if field.annotation is bool:
            return CheckboxField()
        if isclass(field.annotation) and issubclass(field.annotation, StrEnum):
            return SelectField(
                options=[(item.value, item.name) for item in field.annotation]
            )

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
                if _is_skipped_field(field):
                    continue
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
