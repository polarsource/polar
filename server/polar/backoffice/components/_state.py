import contextlib
from collections.abc import Generator
from typing import Any

from polar.backoffice.document import get_document


@contextlib.contextmanager
def empty_state(
    title: str,
    description: str | None = None,
    icon: str | None = None,
    **kwargs: Any,
) -> Generator[None]:
    """Create an empty state component for when there's no data.

    Generates a centered, styled empty state display with optional icon,
    title, description, and call-to-action content.

    Args:
        title: The main heading for the empty state.
        description: Optional description text.
        icon: Optional emoji or icon to display above title.
        **kwargs: Additional HTML attributes.

    Yields:
        None: Context manager yields control for action buttons or additional content.

    Example:
        >>> with empty_state("No Organizations", "Create your first organization", icon="📁"):
        ...     with button(variant="primary"):
        ...         doc.text("Create Organization")
    """
    with doc.div(
        classes="flex flex-col items-center justify-center py-12 px-4 text-center",
        **kwargs,
    ):
        if icon:
            with doc.div(classes="text-6xl mb-4 opacity-50"):
                doc.text(icon)

        with doc.h3(classes="text-xl font-bold mb-2"):
            doc.text(title)

        if description:
            with doc.p(classes="text-base-content/70 mb-4 max-w-md"):
                doc.text(description)

        yield


@contextlib.contextmanager
def loading_state(
    message: str = "Loading...",
    size: str = "md",
    **kwargs: Any,
) -> Generator[None]:
    """Create a loading state component with spinner.

    Generates a centered loading indicator with optional message.
    Uses DaisyUI loading spinner component.

    Args:
        message: Text to display below the spinner.
        size: Spinner size ("xs", "sm", "md", "lg").
        **kwargs: Additional HTML attributes.

    Yields:
        None: Context manager yields control (typically not used).

    Example:
        >>> with loading_state("Fetching organizations...", size="lg"):
        ...     pass
    """
    size_classes = {
        "xs": "loading-xs",
        "sm": "loading-sm",
        "md": "loading-md",
        "lg": "loading-lg",
    }

    with doc.div(
        classes="flex flex-col items-center justify-center py-12 gap-4",
        role="status",
        **kwargs,
    ):
        with doc.span(
            classes=f"loading loading-spinner {size_classes.get(size, 'loading-md')}"
        ):
            pass

        if message:
            with doc.p(classes="text-base-content/70"):
                doc.text(message)

        yield


@contextlib.contextmanager
def card(
    *,
    bordered: bool = True,
    compact: bool = False,
    **kwargs: Any,
) -> Generator[None]:
    """Create a generic card container component.

    Generates a card element with optional border and padding variants.
    Useful for grouping related content.

    Args:
        bordered: If True, adds a border to the card.
        compact: If True, uses less padding.
        **kwargs: Additional HTML attributes (including 'classes' for additional classes).

    Yields:
        None: Context manager yields control for card content.

    Example:
        >>> with card(bordered=True):
        ...     with doc.h3(classes="font-bold"):
        ...         doc.text("Card Title")
        ...     with doc.p():
        ...         doc.text("Card content")
    """
    card_classes = ["card", "bg-base-100"]

    if bordered:
        card_classes.append("border border-base-300")

    padding_class = "p-4" if not compact else "p-3"
    card_classes.append(padding_class)

    # Merge additional classes from kwargs if provided
    additional_classes = kwargs.pop("classes", "")
    if additional_classes:
        card_classes.append(additional_classes)

    with doc.div(classes=" ".join(card_classes), **kwargs):
        yield


__all__ = ["card", "empty_state", "loading_state"]
