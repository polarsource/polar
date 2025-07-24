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
    """Base class for all form field types.

    Provides the interface that all form field implementations must follow.
    Subclasses must implement the render method to define how the field
    is displayed as HTML.
    """

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
        """Render the form field as HTML.

        Args:
            id: The HTML id and name attribute for the field.
            label: The display label for the field.
            required: Whether the field is required for form submission.
            value: The current value of the field.
            errors: List of validation errors to display for this field.

        Yields:
            None: Context manager yields control for field content.

        Raises:
            NotImplementedError: This method must be implemented by subclasses.
        """
        raise NotImplementedError()


class SkipField:
    """Marker class used as metadata to indicate a field should be skipped during form rendering.

    When used as field metadata in a Pydantic model, the field will not be
    included in the automatically generated form. This is useful for fields
    that should not be user-editable or are handled separately.

    Example:
        >>> class UserForm(BaseForm):
        ...     name: str
        ...     email: str
        ...     internal_id: Annotated[str, SkipField()]
    """

    ...


class InputField(FormField):
    """A standard HTML input field with configurable type and attributes.

    Creates input elements with DaisyUI styling, validation error display,
    and proper labeling. Supports all HTML input types and custom attributes.
    """

    def __init__(self, type: str = "text", **kwargs: Any) -> None:
        """Args:
        type: The HTML input type. Defaults to "text".
        **kwargs: Additional HTML attributes for the input element
            (e.g., placeholder, maxlength, pattern, etc.).
        """
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
        """Render the input field with label and error handling.

        Creates a styled input field with proper error states and validation
        message display. The input is wrapped in a label container for
        accessibility and styling.

        Args:
            id: The HTML id and name attribute for the input.
            label: The display label for the input field.
            required: Whether the field is required for form submission.
            value: The current value of the input field.
            errors: List of validation errors to display below the input.

        Yields:
            None: Context manager yields control for the input field.
        """
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
    """A checkbox input field for boolean values.

    Creates a styled checkbox input with DaisyUI classes and proper
    label association. The checkbox value determines the checked state.
    """

    def __init__(self, **kwargs: Any) -> None:
        """Args:
        **kwargs: Additional HTML attributes for the checkbox element
            (e.g., disabled, data attributes, etc.).
        """
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
        """Render the checkbox field with label and error handling.

        Creates a checkbox input with the label as clickable text next to it.
        The checkbox state is determined by the truthiness of the value parameter.

        Args:
            id: The HTML id and name attribute for the checkbox.
            label: The display label for the checkbox (appears next to it).
            required: Whether the field is required for form submission.
            value: The current boolean value of the checkbox.
            errors: List of validation errors to display below the checkbox.

        Yields:
            None: Context manager yields control for the checkbox field.
        """
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
    """A specialized input field for currency values stored as cents.

    Extends InputField to handle currency values that are stored as integers
    in cents but displayed as decimal values to users. Automatically converts
    between the storage format (cents) and display format (dollars/euros).
    """

    def __init__(self, **kwargs: Any) -> None:
        """Args:
        **kwargs: Additional HTML attributes for the input element
            (e.g., min, max, step, etc.).
        """
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
        """Render the currency field with automatic cent-to-decimal conversion.

        Converts the stored integer value (in cents) to a decimal value for
        display. For example, 1250 cents becomes 12.50 for user input.

        Args:
            id: The HTML id and name attribute for the input.
            label: The display label for the currency field.
            required: Whether the field is required for form submission.
            value: The current value in cents (integer), or None.
            errors: List of validation errors to display below the input.

        Yields:
            None: Context manager yields control for the currency field.
        """
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
    """A dropdown select field with configurable options.

    Creates a styled select dropdown with DaisyUI classes, including
    a placeholder option and automatic value selection. Options are
    defined as value-label pairs.
    """

    def __init__(
        self,
        options: list[tuple[str, str]],
        placeholder: str = "Select an option",
        **kwargs: Any,
    ) -> None:
        """Args:
        options: List of (value, label) tuples. The value is submitted
            with the form, the label is displayed to users.
        placeholder: Text for the default empty option that appears
            when no value is selected.
        **kwargs: Additional HTML attributes for the select element
            (e.g., multiple, size, disabled, etc.).
        """
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
        """Render the select field with options and error handling.

        Creates a select dropdown with all configured options, automatically
        selecting the option that matches the provided value. Includes
        validation error display below the select.

        Args:
            id: The HTML id and name attribute for the select.
            label: The display label for the select field.
            required: Whether the field is required for form submission.
            value: The currently selected value, or None for no selection.
            errors: List of validation errors to display below the select.

        Yields:
            None: Context manager yields control for the select field.
        """
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
    """Base class for creating form components from Pydantic models.

    Automatically generates HTML forms based on Pydantic model field definitions.
    Field types are automatically mapped to appropriate form field components,
    and validation errors are displayed inline. Custom form fields can be
    specified using field metadata.

    The form rendering process:
    1. Iterates through model fields
    2. Skips fields marked with SkipField metadata
    3. Determines appropriate FormField type for each field
    4. Renders fields with current values and validation errors
    5. Provides a context for additional form content (buttons, etc.)

    Example:
        >>> class UpdateOrganizationForm(BaseForm):
        ...     name: str
        ...     slug: str
        >>>
        >>> validation_error: ValidationError | None = None
        >>> if request.method == "POST":
        ...     try:
        ...         form = UpdateOrganizationForm.model_validate(data)
        ...         # Process valid form data
        ...     except ValidationError as e:
        ...         validation_error = e
        >>>
        >>> with UpdateOrganizationForm.render(
        ...     data={"name": org.name, "slug": org.slug},
        ...     validation_error=validation_error,
        ...     method="POST"
        ... ):
        ...     # Form fields are automatically rendered
        ...     with button(type="submit"):
        ...         text("Update Organization")
    """

    @classmethod
    @contextlib.contextmanager
    def render(
        cls,
        data: Data | None = None,
        validation_error: ValidationError | None = None,
        **kwargs: AttrValue,
    ) -> Generator[None]:
        """Render the complete form with all fields and validation.

        Generates a form element containing all model fields as appropriate
        form controls. Validation errors are automatically displayed next to
        their corresponding fields. The form can be populated with existing
        data for editing scenarios.

        Args:
            data: Existing data to populate the form fields. Can be a
                dictionary of field values or an object with matching attributes.
            validation_error: Pydantic ValidationError from form submission
                attempt. Errors will be displayed next to relevant fields.
            **kwargs: Additional HTML attributes for the form element
                (e.g., method, action, hx-post, etc.).

        Yields:
            None: Context manager yields control for additional form content
                like submit buttons, hidden fields, or custom sections.
        """
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
