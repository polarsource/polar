import contextlib
from collections.abc import Generator

from tagflow import attr, tag, text
from tagflow.tagflow import AttrValue

from ._button import Size, Variant, button

CLOSE_MODAL_SCRIPT = "on click call me.closest('dialog').close()"


@contextlib.contextmanager
def modal(title: str, *, open: bool = False) -> Generator[None]:
    """Create a modal dialog component using DaisyUI modal classes.

    Generates a modal dialog with a title, close button, and content area.
    The modal can be opened by default or controlled programmatically.
    It includes both a close button in the top-right corner and a backdrop
    click-to-close functionality.

    The modal structure includes:
    - Dialog element with DaisyUI modal classes
    - Modal box container with responsive sizing
    - Close button (X) in top-right corner
    - Modal title as an h3 heading
    - Content area for modal body
    - Backdrop overlay for click-to-close

    Args:
        title: The text to display in the modal header.
        open: If True, the modal will be open by default. If False,
            the modal will be closed and can be opened via JavaScript
            or HTMX interactions.

    Yields:
        None: Context manager yields control for modal body content.

    Example:
        >>> with modal("Confirm Delete", open=True):
        ...     with tag.p():
        ...         text("Are you sure you want to delete this item?")
        ...     with tag.div(classes="modal-action"):
        ...         with button(variant="error"):
        ...             text("Delete")
        # Generates an open modal with title and content
    """
    with tag.dialog(classes="modal modal-bottom sm:modal-middle"):
        if open:
            attr("open", True)
        with tag.div(classes="modal-box"):
            with tag.form(method="dialog"):
                with tag.button(
                    classes="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                ):
                    with tag.div(classes="icon-x"):
                        pass
            with tag.h3(classes="text-lg font-bold mb-4"):
                text(title)
            yield
        with tag.form(method="dialog", classes="modal-backdrop"):
            with tag.button():
                pass


@contextlib.contextmanager
def modal_close_button(
    *,
    variant: Variant | None = None,
    size: Size | None = None,
    ghost: bool = False,
    link: bool = False,
    soft: bool = False,
    outline: bool = False,
    **kwargs: AttrValue,
) -> Generator[None]:
    """Create a button that closes the enclosing modal without submitting anything.

    Use this for "Cancel" and other dismiss actions instead of wrapping the
    button in a `<form method="dialog">`. HTML5 forbids nested `<form>` elements:
    when a dismiss form sits inside an action form, the parser drops it and the
    button becomes a submit button of the action form, so clicking "Cancel"
    performs the action it was meant to abort.

    The button is a `type="button"`, so it never submits any form regardless of
    where it is rendered, and closes the surrounding `<dialog>` via hyperscript.

    Args:
        variant: The button color variant, as in `button`.
        size: The button size, as in `button`.
        ghost: If True, applies ghost styling.
        link: If True, styles the button to look like a link.
        soft: If True, applies soft styling modifier.
        outline: If True, applies outline styling.
        **kwargs: Additional HTML attributes for the button element.

    Yields:
        None: Context manager yields control for button content.

    Example:
        >>> with modal_close_button(ghost=True):
        ...     text("Cancel")
    """
    with button(
        variant=variant,
        size=size,
        ghost=ghost,
        link=link,
        soft=soft,
        outline=outline,
        type="button",
        _=CLOSE_MODAL_SCRIPT,
        **kwargs,
    ):
        yield


__all__ = ["CLOSE_MODAL_SCRIPT", "modal", "modal_close_button"]
