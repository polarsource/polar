import contextlib
from collections.abc import Generator
from typing import Any, Literal, TypedDict

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
) -> Generator[None]:
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

    with doc.dialog(classes="modal modal-bottom sm:modal-middle", **kwargs):
        if open:
            doc.attr("open", True)

        with doc.div(classes="modal-box"):
            # Close button
            with doc.form(method="dialog"):
                with doc.button(
                    classes="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                ):
                    with doc.div(classes="icon-x"):
                        pass

            # Icon and title
            with doc.div(classes="flex items-center gap-3 mb-4"):
                with doc.div(classes="text-4xl"):
                    doc.text(config["icon"])
                with doc.h3(classes="text-lg font-bold"):
                    doc.text(title)

            # Message
            with doc.p(classes="text-base-content/80 mb-6"):
                doc.text(message)

            # Action buttons
            with doc.div(classes="modal-action"):
                # Cancel button (closes dialog)
                with doc.form(method="dialog"):
                    with button(variant="secondary", size="md"):
                        doc.text(cancel_text)

                # Confirm button (yielded for custom action)
                with button(variant=config["button"], size="md"):
                    doc.text(confirm_text)
                    yield

        # Backdrop
        with doc.form(method="dialog", classes="modal-backdrop"):
            with doc.button():
                pass


__all__ = ["Variant", "confirmation_dialog"]
