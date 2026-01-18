import contextlib
from collections.abc import Generator

from markupflow import Fragment


@contextlib.contextmanager
def modal(title: str, *, open: bool = False) -> Generator[Fragment]:
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
        Fragment: The fragment for adding modal body content.

    Example:
        >>> with modal("Confirm Delete", open=True) as m:
        ...     with m.p():
        ...         m.text("Are you sure you want to delete this item?")
        ...     with m.div(class_="modal-action"):
        ...         with m.fragment(button(variant="error")) as btn:
        ...             btn.text("Delete")
        # Generates an open modal with title and content
    """
    fragment = Fragment()
    with fragment.tag("dialog", class_="modal modal-bottom sm:modal-middle"):
        if open:
            fragment.attr("open", True)
        with fragment.div(class_="modal-box"):
            with fragment.form(method="dialog"):
                with fragment.button(
                    class_="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                ):
                    with fragment.div(class_="icon-x"):
                        pass
            with fragment.h3(class_="text-lg font-bold mb-4"):
                fragment.text(title)
            yield fragment
        with fragment.form(method="dialog", class_="modal-backdrop"):
            with fragment.button():
                pass


__all__ = ["modal"]
