import contextlib
from collections.abc import Generator
from typing import Any

from markupflow import Fragment


@contextlib.contextmanager
def empty_state(
    title: str,
    description: str | None = None,
    icon: str | None = None,
    **kwargs: Any,
) -> Generator[Fragment]:
    """Create an empty state component for when there's no data.

    Generates a centered, styled empty state display with optional icon,
    title, description, and call-to-action content.

    Args:
        title: The main heading for the empty state.
        description: Optional description text.
        icon: Optional emoji or icon to display above title.
        **kwargs: Additional HTML attributes.

    Yields:
        Fragment: The fragment for adding action buttons or additional content.

    Example:
        >>> with empty_state("No Organizations", "Create your first organization", icon="📁") as state:
        ...     with state.fragment(button(variant="primary")) as btn:
        ...         btn.text("Create Organization")
    """
    fragment = Fragment()
    with fragment.div(
        class_="flex flex-col items-center justify-center py-12 px-4 text-center",
        **kwargs,
    ):
        if icon:
            with fragment.div(class_="text-6xl mb-4 opacity-50"):
                fragment.text(icon)

        with fragment.h3(class_="text-xl font-bold mb-2"):
            fragment.text(title)

        if description:
            with fragment.p(class_="text-base-content/70 mb-4 max-w-md"):
                fragment.text(description)

        yield fragment


@contextlib.contextmanager
def loading_state(
    message: str = "Loading...",
    size: str = "md",
    **kwargs: Any,
) -> Generator[Fragment]:
    """Create a loading state component with spinner.

    Generates a centered loading indicator with optional message.
    Uses DaisyUI loading spinner component.

    Args:
        message: Text to display below the spinner.
        size: Spinner size ("xs", "sm", "md", "lg").
        **kwargs: Additional HTML attributes.

    Yields:
        Fragment: The fragment for additional content (typically not used).

    Example:
        >>> with loading_state("Fetching organizations...", size="lg") as state:
        ...     pass
    """
    size_classes = {
        "xs": "loading-xs",
        "sm": "loading-sm",
        "md": "loading-md",
        "lg": "loading-lg",
    }

    fragment = Fragment()
    with fragment.div(
        class_="flex flex-col items-center justify-center py-12 gap-4",
        role="status",
        **kwargs,
    ):
        with fragment.span(
            class_=f"loading loading-spinner {size_classes.get(size, 'loading-md')}"
        ):
            pass

        if message:
            with fragment.p(class_="text-base-content/70"):
                fragment.text(message)

        yield fragment


@contextlib.contextmanager
def card(
    *,
    bordered: bool = True,
    compact: bool = False,
    **kwargs: Any,
) -> Generator[Fragment]:
    """Create a generic card container component.

    Generates a card element with optional border and padding variants.
    Useful for grouping related content.

    Args:
        bordered: If True, adds a border to the card.
        compact: If True, uses less padding.
        **kwargs: Additional HTML attributes (including 'class_' for additional classes).

    Yields:
        Fragment: The fragment for adding card content.

    Example:
        >>> with card(bordered=True) as c:
        ...     with c.h3(class_="font-bold"):
        ...         c.text("Card Title")
        ...     with c.p():
        ...         c.text("Card content")
    """
    card_classes = ["card", "bg-base-100"]

    if bordered:
        card_classes.append("border border-base-300")

    padding_class = "p-4" if not compact else "p-3"
    card_classes.append(padding_class)

    # Merge additional classes from kwargs if provided
    additional_classes = kwargs.pop("class_", None) or kwargs.pop("classes", "")
    if additional_classes:
        card_classes.append(additional_classes)

    fragment = Fragment()
    with fragment.div(class_=" ".join(card_classes), **kwargs):
        yield fragment


__all__ = ["card", "empty_state", "loading_state"]
