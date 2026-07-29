from dataclasses import dataclass

from pydantic import AnyUrl, TypeAdapter, ValidationError

DEFAULT_PORTS = {"http": 80, "https": 443}
DEFAULT_SCHEME = "https"

MAX_HOST_LENGTH = 253

WILDCARD_PREFIX = "*."
# Stands in for the wildcard so an entry can go through the origin parser.
_WILDCARD_LABEL = "wildcard"

_url_adapter = TypeAdapter(AnyUrl)


class InvalidEmbedHost(ValueError):
    def __init__(self, value: str, reason: str) -> None:
        self.value = value
        super().__init__(f"{value!r} is not a valid embed host: {reason}")


@dataclass(frozen=True, slots=True)
class ParsedOrigin:
    scheme: str
    host: str
    port: int | None

    def __str__(self) -> str:
        if self.port is None or self.port == DEFAULT_PORTS.get(self.scheme):
            return f"{self.scheme}://{self.host}"
        return f"{self.scheme}://{self.host}:{self.port}"


@dataclass(frozen=True, slots=True)
class HostPattern:
    scheme: str
    host: str
    port: int | None
    wildcard: bool

    def __str__(self) -> str:
        scheme = f"{self.scheme}://" if self.scheme != DEFAULT_SCHEME else ""
        host = f"{WILDCARD_PREFIX}{self.host}" if self.wildcard else self.host
        port = (
            f":{self.port}"
            if self.port is not None and self.port != DEFAULT_PORTS.get(self.scheme)
            else ""
        )
        return f"{scheme}{host}{port}"

    def matches(self, origin: ParsedOrigin) -> bool:
        if origin.scheme != self.scheme or origin.port != self.port:
            return False
        if self.wildcard:
            return origin.host.endswith(f".{self.host}")
        return origin.host == self.host


def _parse_url(value: str) -> AnyUrl | None:
    try:
        return _url_adapter.validate_python(value)
    except ValidationError:
        return None


def parse_origin(value: str) -> ParsedOrigin | None:
    """Path, query, fragment and credentials are dropped: `postMessage` compares
    the origin of `targetOrigin` and ignores the rest. `null` and `file://`
    carry no origin at all."""
    url = _parse_url(value)
    if url is None or url.host is None or "*" in url.host:
        return None

    return ParsedOrigin(url.scheme, url.host, url.port)


def parse_host_pattern(value: str) -> HostPattern | None:
    """An entry is a host with an optional scheme and port — `example.com`,
    `*.example.com`, `localhost:3000`, `http://192.168.1.43:5500` — and HTTPS
    when no scheme is given. It shares the URL parser with `parse_origin` so an
    entry and the origin it must match normalize alike, punycode included."""
    entry = value.strip()
    scheme, separator, remainder = entry.partition("://")
    if not separator:
        scheme, remainder = DEFAULT_SCHEME, entry

    wildcard = remainder.startswith(WILDCARD_PREFIX)
    host = remainder.removeprefix(WILDCARD_PREFIX) if wildcard else remainder
    if not host or "*" in host:
        return None

    probe = f"{scheme}://{_WILDCARD_LABEL}.{host}" if wildcard else f"{scheme}://{host}"
    url = _parse_url(probe)
    if url is None or url.host is None:
        return None

    # An origin may carry these and lose them; an entry has to be a host alone.
    if url.path not in (None, "", "/") or url.query is not None:
        return None
    if url.fragment is not None or url.username is not None:
        return None

    parsed_host = url.host.removeprefix(f"{_WILDCARD_LABEL}.") if wildcard else url.host
    if len(parsed_host) > MAX_HOST_LENGTH:
        return None

    return HostPattern(url.scheme, parsed_host, url.port, wildcard)


def validate_host_pattern(value: str) -> str:
    if not value.strip():
        raise InvalidEmbedHost(value, "it is empty")

    if value.strip().removeprefix(WILDCARD_PREFIX).strip() in ("", "*"):
        raise InvalidEmbedHost(value, "a bare wildcard would let any page embed")

    pattern = parse_host_pattern(value)
    if pattern is None:
        raise InvalidEmbedHost(
            value, "write a host, with an optional scheme and port, and no path"
        )

    return str(pattern)


def match_origin(origin: str, hosts: list[str]) -> str | None:
    """Return the normalized origin when the allowlist admits it."""
    parsed = parse_origin(origin)
    if parsed is None:
        return None

    for entry in hosts:
        pattern = parse_host_pattern(entry)
        if pattern is not None and pattern.matches(parsed):
            return str(parsed)

    return None
