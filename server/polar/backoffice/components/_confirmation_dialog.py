import contextlib
from collections.abc import Generator
from typing import Any, Literal, TypedDict

from markupflow import Fragment

from ._button import Variant as ButtonVariant
from ._button import button

Variant = Literal["info", "success", "warning", "error"]


class VariantConfig(TypedDict):
    icon: str
    button: ButtonVariant


@contextlib.contextmanager
def confirmation_dialog(
    title: str,
    message: str,
    *,
    variant: Variant = "warning",
    confirm_text: str = "Confirm",
    cancel_text: str = "Cancel",
    open: bool = False,
    **kwargs: Any,
) -> Generator[Fragment]:
    """Create a standardized confirmation dialog component.

    Generates a modal dialog for confirming actions with semantic styling,
    clear messaging, and consistent button placement. Useful for destructive
    actions or important decisions.

    Args:
        title: The dialog title/heading.
        message: The confirmation message/question.
        variant: Visual style variant affecting icon and confirm button color.
        confirm_text: Text for the confirm button.
        cancel_text: Text for the cancel button.
        open: If True, the dialog will be open by default.
        **kwargs: Additional HTML attributes for the dialog.

    Yields:
        None: Context manager yields control for confirm button attributes.
             The yielded content should add form action or hx-* attributes.

    Example:
        >>> with confirmation_dialog(
        ...     "Delete Organization",
        ...     "Are you sure? This cannot be undone.",
        ...     variant="error",
        ...     confirm_text="Delete",
        ...     open=True
        ... ):
        ...     # Add form action to confirm button
        ...     pass
    """
    variant_config: dict[str, VariantConfig] = {
        "info": {"icon": "ℹ️", "button": "info"},
        "success": {"icon": "✅", "button": "success"},
        "warning": {"icon": "⚠️", "button": "warning"},
        "error": {"icon": "❌", "button": "error"},
    }

    config = variant_config.get(variant, variant_config["warning"])

    fragment = Fragment()
    with fragment.dialog(class_="modal modal-bottom sm:modal-middle", **kwargs):
        if open:
            fragment.attr("open", True)

        with fragment.div(class_="modal-box"):
            # Close button
            with fragment.form(method="dialog"):
                with fragment.button(
                    class_="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                ):
                    with fragment.div(class_="icon-x"):
                        pass

            # Icon and title
            with fragment.div(class_="flex items-center gap-3 mb-4"):
                with fragment.div(class_="text-4xl"):
                    fragment.text(config["icon"])
                with fragment.h3(class_="text-lg font-bold"):
                    fragment.text(title)

            # Message
            with fragment.p(class_="text-base-content/80 mb-6"):
                fragment.text(message)

            # Action buttons
            with fragment.div(class_="modal-action"):
                # Cancel button (closes dialog)
                with fragment.form(method="dialog"):
                    with button(variant="secondary", size="md"):
                        fragment.text(cancel_text)

                # Confirm button (yielded for custom action)
                with button(variant=config["button"], size="md"):
                    fragment.text(confirm_text)
                    yield fragment

        # Backdrop
        with fragment.form(method="dialog", class_="modal-backdrop"):
            with fragment.button():
                pass


__all__ = ["Variant", "confirmation_dialog"]
