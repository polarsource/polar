import contextlib
from collections.abc import Callable, Generator
from datetime import datetime
from inspect import isgenerator
from operator import attrgetter
from typing import Any

from fastapi import Request
from fastapi.datastructures import URL

from .. import formatters
from ._clipboard_button import clipboard_button
from polar.backoffice.document import get_document
class DescriptionListItem[M]:
    """Base class for description list items.

    Provides the foundation for all description list item types. Subclasses must
    implement the render method to define how the item content is displayed.

    Args:
        M: Type parameter representing the model type that this item will display.
    """

    label: str

    def __init__(self, label: str) -> None:
        """
        Args:
            label: The text to display as the item label.
        """
        self.label = label

    def render(self, request: Request, item: M) -> Generator[None] | None:
        """Render the item content for a specific data object.

        Args:
            request: The FastAPI request object.
            item: The data object to render information from.
        """
        raise NotImplementedError()

    @contextlib.contextmanager
    def _do_render(self, request: Request, item: M) -> Generator[None]:
        value = self.render(request, item)
        if isgenerator(value):
            yield from value
        else:
            yield

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(label={self.label!r})"
class DescriptionListAttrItem[M](DescriptionListItem[M]):
    """A description list item that displays an attribute value from the model.

    This item extracts and displays a specific attribute from the data object.
    It supports optional clipboard functionality for copying the displayed value.

    Args:
        M: Type parameter for the model type.
    """

    attr: str
    clipboard: bool

    def __init__(
        self, attr: str, label: str | None = None, *, clipboard: bool = False
    ) -> None:
        """
        Args:
            attr: The attribute name to extract from data objects (supports dot notation).
            label: The label text. If None, uses the attribute name.
            clipboard: If True, adds a clipboard button to copy the value.
        """
        self.attr = attr
        self.clipboard = clipboard
        super().__init__(label or attr)

    def render(self, request: Request, item: M) -> Generator[None] | None:
        """Render the attribute value as a description list item.

        Args:
            request: The FastAPI request object.
            item: The data object to extract the attribute from.
        """
        value = self.get_value(item)
        with doc.div(classes="flex items-center gap-1"):
            doc.text(value if value is not None else "—")
            if value is not None and self.clipboard:
                with clipboard_button(value):
                    pass
        return None

    def get_raw_value(self, item: M) -> Any | None:
        """Extract the raw attribute value from the data object.

        Args:
            item: The data object to extract from.

        Returns:
            The raw attribute value

        Raises:
            AttributeError: If the attribute does not exist on the item.
        """
        return attrgetter(self.attr)(item)

    def get_value(self, item: M) -> str | None:
        """Get the formatted string value for display.

        This method can be overridden in subclasses to provide custom formatting.

        Args:
            item: The data object to extract from.

        Returns:
            The formatted string value, or None if the raw value is None.

        Raises:
            AttributeError: If the attribute does not exist on the item.
        """
        value = self.get_raw_value(item)
        if value is None:
            return None
        return str(value)

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(attr={self.attr!r}, label={self.label!r}, clipboard={self.clipboard})"
class DescriptionListDateTimeItem[M](DescriptionListAttrItem[M]):
    """A description list item that displays datetime attributes with proper formatting.

    Extends DescriptionListAttrItem to format datetime values using the backoffice
    datetime formatter. Raw datetime objects are converted to user-friendly
    formatted strings.

    Args:
        M: Type parameter for the model type.
    """

    def get_value(self, item: M) -> str | None:
        """Get the formatted datetime string for display.

        Args:
            item: The data object to extract the datetime from.

        Returns:
            A formatted datetime string, or None if the raw value is None.

        Raises:
            AttributeError: If the attribute does not exist on the item.
        """
        value: datetime | None = self.get_raw_value(item)
        if value is None:
            return None
        return formatters.datetime(value)
class DescriptionListLinkItem[M](DescriptionListAttrItem[M]):
    """A description list item that generates a link.

    Args:
        M: Type parameter for the model type.
    """

    href_getter: Callable[[Request, M], str | URL | None]

    def __init__(
        self,
        attr: str,
        label: str | None = None,
        *,
        external: bool = False,
        href_getter: Callable[[Request, M], str | URL | None] | None = None,
    ) -> None:
        super().__init__(attr, label, clipboard=False)
        self.external = external

        if href_getter is None:

            def _default_href_getter(_: Request, item: M) -> str | URL | None:
                return self.get_raw_value(item)

            self.href_getter = _default_href_getter
        else:
            self.href_getter = href_getter

    def render(self, request: Request, item: M) -> Generator[None] | None:
        """Render the attribute value as an external link.

        Args:
            request: The FastAPI request object.
            item: The data object to extract the link from.
        """
        value = self.get_raw_value(item)
        href = self.href_getter(request, item)
        with doc.div(classes="flex items-center gap-1"):
            if value is not None:
                with doc.a(href=href, classes="link"):
                    if self.external:
                        doc.attr("class", "flex flex-row gap-1")
                        doc.attr("target", "_blank")
                        doc.attr("rel", "noopener noreferrer")
                    doc.text(str(value))
                    if self.external:
                        with doc.div(classes="icon-external-link"):
                            pass
            else:
                doc.text("—")
        return None

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(attr={self.attr!r}, label={self.label!r}, external={self.external!r})"
class DescriptionListCurrencyItem[M](DescriptionListAttrItem[M]):
    """A description list item that displays currency values with proper formatting.

    Extends DescriptionListAttrItem to format integer currency values (in cents)
    using the backoffice currency formatter. The currency type can be customized
    by overriding the get_currency method.

    Args:
        M: Type parameter for the model type.
    """

    def get_value(self, item: M) -> str | None:
        """Get the formatted currency string for display.

        Args:
            item: The data object to extract the currency value from.

        Returns:
            A formatted currency string, or None if the raw value is None.
        """
        value: int | None = self.get_raw_value(item)
        if value is None:
            return None
        return formatters.currency(value, self.get_currency(item))

    def get_currency(self, item: M) -> str:
        """Get the currency code for formatting.

        By default, tries to extract the attribute 'currency' from the item,
        falling back to "usd" if not present. This can be overridden in subclasses
        to provide custom currency handling.

        Args:
            item: The data object (unused in base implementation).

        Returns:
            The currency code.
        """
        return getattr(item, "currency", "usd")
class DescriptionListSocialsItem[M](DescriptionListItem[M]):
    """A description list item that displays social links with platform icons.

    This item displays social links from the model, including both the socials
    list and twitter_username field, with appropriate formatting and icons.

    Args:
        M: Type parameter for the model type.
    """

    def render(self, request: Request, item: M) -> Generator[None] | None:
        """Render social links with platform icons and external links.

        Args:
            request: The FastAPI request object.
            item: The data object to render social links from.
        """
        socials = getattr(item, "socials", [])
        twitter_username = getattr(item, "twitter_username", None)

        with doc.div(classes="flex flex-col gap-2"):
            # Display Twitter/X username if available
            if twitter_username:
                with doc.div(classes="flex items-center gap-2"):
                    with doc.span(classes="text-sm font-medium"):
                        doc.text("𝕏 (Twitter):")
                    with doc.a(
                        href=f"https://twitter.com/{twitter_username}",
                        classes="link flex items-center gap-1",
                        target="_blank",
                        rel="noopener noreferrer",
                    ):
                        doc.text(f"@{twitter_username}")
                        with doc.div(classes="icon-external-link"):
                            pass

            # Display social links from socials field
            if socials:
                for social in socials:
                    platform = social.get("platform", "")
                    url = social.get("url", "")
                    if platform and url:
                        with doc.div(classes="flex items-center gap-2"):
                            with doc.span(classes="text-sm font-medium"):
                                # Add platform-specific icons/emojis
                                if platform.lower() in ["twitter", "x"]:
                                    doc.text("𝕏:")
                                elif platform.lower() == "github":
                                    doc.text("GitHub:")
                                elif platform.lower() == "linkedin":
                                    doc.text("LinkedIn:")
                                elif platform.lower() == "youtube":
                                    doc.text("YouTube:")
                                elif platform.lower() == "instagram":
                                    doc.text("Instagram:")
                                elif platform.lower() == "facebook":
                                    doc.text("Facebook:")
                                elif platform.lower() == "discord":
                                    doc.text("Discord:")
                                else:
                                    doc.text(f"{platform.title()}:")
                            with doc.a(
                                href=url,
                                classes="link flex items-center gap-1",
                                target="_blank",
                                rel="noopener noreferrer",
                            ):
                                # Display the URL or just the platform name
                                display_text = url
                                if url.startswith("https://"):
                                    display_text = url[8:]  # Remove https://
                                elif url.startswith("http://"):
                                    display_text = url[7:]  # Remove http://
                                doc.text(display_text)
                                with doc.div(classes="icon-external-link"):
                                    pass

            # Show message if no social links
            if not socials and not twitter_username:
                with doc.span(classes="text-gray-500 italic"):
                    doc.text("No social links available")
        return None
class DescriptionList[M]:
    """A complete description list component for displaying structured data.

    Renders a formatted description list (HTML <dl>) with labels and values.
    Each item is rendered with its label and corresponding value.

    Args:
        M: Type parameter for the model type being displayed.
    """

    def __init__(self, *items: DescriptionListItem[M]) -> None:
        """
        Args:
            *items: Variable number of DescriptionListItem instances that define
                the list structure and content.
        """
        self.items = items

    @contextlib.contextmanager
    def render(self, request: Request, data: M) -> Generator[None]:
        """Render the complete description list with all items.

        Args:
            request: The FastAPI request object for URL generation.
            data: The data object to display information from.
        """
        with doc.dl(classes="divide-y divide-gray-100"):
            with doc.div(classes="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"):
                for item in self.items:
                    with doc.dt(classes="text-sm/6 font-medium"):
                        doc.text(item.label)
                        with doc.dd(classes="mt-1 text-sm/6 sm:col-span-2 sm:mt-0"):
                            with item._do_render(request, data):
                                pass
        yield

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(items={self.items!r})"


__all__ = [
    "DescriptionList",
    "DescriptionListAttrItem",
    "DescriptionListDateTimeItem",
    "DescriptionListItem",
    "DescriptionListLinkItem",
]
