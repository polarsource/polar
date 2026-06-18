import re

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_API_VERSION_PATTERN = re.compile(r"^(\d{4})-(\d{2})$")


class APIVersion:
    """
    Represents an API version in the format "YYYY-MM".
    """

    __slots__ = ("month", "year")
    year: int
    month: int

    def __init__(self, year: int, month: int):
        self.year = year
        self.month = month

    def __str__(self) -> str:
        return f"{self.year}-{self.month:02d}"

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.year!r}, {self.month!r})"

    def __eq__(self, value: object, /) -> bool:
        if not isinstance(value, APIVersion):
            return NotImplemented
        return value.year == self.year and value.month == self.month

    def __lt__(self, value: object, /) -> bool:
        if not isinstance(value, APIVersion):
            return NotImplemented
        if self.year != value.year:
            return self.year < value.year
        return self.month < value.month

    def __le__(self, value: object, /) -> bool:
        if not isinstance(value, APIVersion):
            return NotImplemented
        if self.year != value.year:
            return self.year < value.year
        return self.month <= value.month

    def __gt__(self, value: object, /) -> bool:
        if not isinstance(value, APIVersion):
            return NotImplemented
        if self.year != value.year:
            return self.year > value.year
        return self.month > value.month

    def __ge__(self, value: object, /) -> bool:
        if not isinstance(value, APIVersion):
            return NotImplemented
        if self.year != value.year:
            return self.year > value.year
        return self.month >= value.month

    @classmethod
    def parse(cls, version_str: str) -> "APIVersion":
        match = re.fullmatch(_API_VERSION_PATTERN, version_str)
        if not match:
            raise ValueError(f"Invalid version string: {version_str}")
        year_str, month_str = match.groups()
        return cls(year=int(year_str), month=int(month_str))


VERSION_HEADER = "Polar-Version"


class APIVersionMiddleware:
    """
    Middleware to add the current API version to the response headers.

    In the future, it'll also be responsible to _read_ the API version from the request headers.
    """

    def __init__(self, app: ASGIApp, current: APIVersion) -> None:
        self.app = app
        self.current = current

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                headers = MutableHeaders(scope=message)
                headers[VERSION_HEADER] = str(self.current)
            await send(message)

        await self.app(scope, receive, send_wrapper)


CURRENT_API_VERSION = APIVersion(year=2026, month=4)
