import contextlib
from collections.abc import Generator, Sequence

from tagflow import classes as _classes
from tagflow import tag, text
from tagflow.tagflow import AttrValue


@contextlib.contextmanager
def search(
    name: str | None = None, value: str | None = None, placeholder: str | None = None
) -> Generator[None]:
    """Create a search input component with an integrated search icon.

    Generates a styled search input field with a search icon on the left side.
    The component uses DaisyUI's input classes and includes a search icon
    for visual clarity. The input type is set to "search" for semantic meaning
    and browser-specific behavior.

    Args:
        name: The name attribute for the input field. Used for form submission.
        value: The current value of the search input.
        placeholder: Placeholder text to display when the input is empty.

    Example:
        >>> with search(name="query", placeholder="Search users..."):
        ...     pass
    """
    with tag.label(classes="input"):
        with tag.div(classes="icon-search opacity-50"):
            pass
        with tag.input(
            type="search",
            classes="grow",
            name=name,
            value=value,
            placeholder=placeholder,
        ):
            pass
    yield


@contextlib.contextmanager
def select(
    options: Sequence[tuple[str, str]],
    value: str | None = None,
    *,
    placeholder: str | None = None,
    classes: str | None = None,
    **kwargs: AttrValue,
) -> Generator[None]:
    """Create a styled select dropdown component.

    Generates a select element with DaisyUI styling and configurable options.
    The component supports an optional placeholder option and automatic
    selection of the current value. Additional CSS classes and HTML attributes
    can be passed through for customization.

    Args:
        options: Sequence of (label, value) tuples defining the select options.
            The label is displayed to users, the value is submitted with forms.
        value: The currently selected value. If provided, the matching option
            will be marked as selected.
        placeholder: Optional placeholder text shown as the first option with
            an empty value. Only displayed if no value is currently selected.
        classes: Additional CSS classes to apply to the select element.
        **kwargs: Additional HTML attributes to pass to the select element
            (e.g., name, id, disabled, etc.).

    Example:
        >>> options = [("Active", "active"), ("Inactive", "inactive")]
        >>> with select(options, value="active", name="status", placeholder="Choose status"):
        ...     pass
    """
    with tag.select(classes="select", **kwargs):
        if classes is not None:
            _classes(classes)
        if placeholder is not None:
            with tag.option(value="", selected=not value):
                text(placeholder)
        for option_label, option_value in options:
            with tag.option(value=option_value, selected=option_value == value):
                text(option_label)
    yield


__all__ = ["search", "select"]
