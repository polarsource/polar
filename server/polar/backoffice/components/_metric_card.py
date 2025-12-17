import contextlib
from collections.abc import Generator
from typing import Any, Literal

from tagflow import tag, text

Variant = Literal["default", "success", "warning", "error", "info"]


@contextlib.contextmanager
def metric_card(
    label: str,
    value: str | int | float,
    *,
    variant: Variant = "default",
    subtitle: str | None = None,
    trend: Literal["up", "down", "neutral"] | None = None,
    compact: bool = False,
    **kwargs: Any,
) -> Generator[None]:
    """Create a metric display card component.

    Generates a card showing a key metric with label, value, and optional
    subtitle or trend indicator. Useful for dashboards and stat displays.

    Args:
        label: The metric label (e.g., "Total Payments").
        value: The metric value to display (will be converted to string).
        variant: Visual style variant affecting border/background color.
        subtitle: Optional secondary text below the value.
        trend: Optional trend indicator ("up", "down", "neutral").
        compact: If True, uses more compact padding and sizing.
        **kwargs: Additional HTML attributes.

    Yields:
        None: Context manager yields control for additional card content.

    Example:
        >>> with metric_card("Total Revenue", "$1,234", variant="success", trend="up"):
        ...     pass
    """
    variant_classes = {
        "default": "border-base-300",
        "success": "border-base-300",
        "warning": "border-base-300",
        "error": "border-base-300",
        "info": "border-base-300",
    }

    trend_icons = {
        "up": "↗",
        "down": "↘",
        "neutral": "→",
    }

    trend_colors = {
        "up": "text-base-content/60",
        "down": "text-base-content/60",
        "neutral": "text-base-content/50",
    }

    padding_class = "p-3" if compact else "p-4"

    with tag.div(
        classes=f"card border {padding_class} {variant_classes[variant]}",
        **kwargs,
    ):
        with tag.div(classes="flex flex-col gap-1"):
            # Label
            with tag.div(
                classes="text-xs uppercase font-semibold text-base-content/60"
            ):
                text(label)

            # Value with optional trend
            with tag.div(classes="flex items-baseline gap-2"):
                size_class = "text-xl" if compact else "text-3xl"
                with tag.div(classes=f"{size_class} font-bold font-mono"):
                    text(str(value))

                if trend:
                    with tag.span(classes=f"text-lg {trend_colors[trend]}"):
                        text(trend_icons[trend])

            # Optional subtitle
            if subtitle:
                with tag.div(classes="text-sm text-base-content/70"):
                    text(subtitle)

            # Allow additional content
            yield


__all__ = ["Variant", "metric_card"]
