import ipaddress
from dataclasses import dataclass

from pydantic import AnyUrl, TypeAdapter, ValidationError

DEFAULT_PORTS = {"http": 80, "https": 443}
WEB_SCHEMES = frozenset(DEFAULT_PORTS)

MAX_HOST_LENGTH = 253

WILDCARD_PREFIX = "*."
# Stands in for the wildcard so an entry can go through the origin parser.
_WILDCARD_LABEL = "wildcard"
_PORT_PROBE_SCHEME = "x-polar-probe"

_LOCAL_SUFFIXES = (".localhost", ".local")

_url_adapter = TypeAdapter(AnyUrl)


class InvalidEmbedHost(ValueError):
    def __init__(self, value: str, reason: str) -> None:
        self.value = value
        super().__init__(f"{value!r} is not a valid embed host: {reason}")


def is_local_host(host: str) -> bool:
    """Hosts a browser can only reach from the developer's own machine or LAN."""
    if host == "localhost" or host.endswith(_LOCAL_SUFFIXES):
        return True
    try:
        address = ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        return False
    return address.is_loopback or address.is_private


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
    """`scheme` is `None` for a web host, which admits HTTPS, and HTTP too when
    the host is local. App origins carry their scheme, having no host to match
    on."""

    scheme: str | None
    host: str
    port: int | None
    wildcard: bool

    def __str__(self) -> str:
        scheme = f"{self.scheme}://" if self.scheme is not None else ""
        host = f"{WILDCARD_PREFIX}{self.host}" if self.wildcard else self.host
        default_port = DEFAULT_PORTS.get(self.scheme or "https")
        port = f":{self.port}" if self.port not in (None, default_port) else ""
        return f"{scheme}{host}{port}"

    def matches(self, origin: ParsedOrigin) -> bool:
        if self.scheme is None:
            if origin.scheme == "http":
                if not is_local_host(origin.host):
                    return False
            elif origin.scheme != "https":
                return False
        elif origin.scheme != self.scheme:
            return False

        expected_port = (
            self.port if self.port is not None else DEFAULT_PORTS.get(origin.scheme)
        )
        if origin.port != expected_port:
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
    """A web host carries no scheme — `example.com`, `*.example.com`,
    `192.168.1.43:5500`. Anything else is a full app origin,
    `chrome-extension://abcdef`. Entries share the URL parser with
    `parse_origin` so both normalize alike, punycode included."""
    entry = value.strip()
    written_scheme, separator, remainder = entry.partition("://")
    scheme = written_scheme.lower() if separator else None
    if scheme is None:
        remainder = entry
    elif scheme in WEB_SCHEMES:
        return None

    wildcard = remainder.startswith(WILDCARD_PREFIX)
    host = remainder.removeprefix(WILDCARD_PREFIX) if wildcard else remainder
    if not host or "*" in host:
        return None

    probe_scheme = scheme if scheme is not None else "https"
    probe_host = f"{_WILDCARD_LABEL}.{host}" if wildcard else host
    url = _parse_url(f"{probe_scheme}://{probe_host}")
    if url is None or url.host is None:
        return None

    # A web scheme substitutes its default port; this one reports what was written.
    port_probe = _parse_url(f"{_PORT_PROBE_SCHEME}://{probe_host}")
    port = port_probe.port if port_probe is not None else None

    # An origin may carry these and lose them; an entry has to be a host alone.
    if url.path not in (None, "", "/") or url.query is not None:
        return None
    if url.fragment is not None or url.username is not None:
        return None

    parsed_host = url.host.removeprefix(f"{_WILDCARD_LABEL}.") if wildcard else url.host
    if len(parsed_host) > MAX_HOST_LENGTH:
        return None

    return HostPattern(
        url.scheme if scheme is not None else None, parsed_host, port, wildcard
    )


def validate_host_pattern(value: str) -> str:
    entry = value.strip()
    if not entry:
        raise InvalidEmbedHost(value, "it is empty")

    if entry.removeprefix(WILDCARD_PREFIX).strip() in ("", "*"):
        raise InvalidEmbedHost(value, "a bare wildcard would let any page embed")

    if entry.partition("://")[0].lower() in WEB_SCHEMES:
        raise InvalidEmbedHost(
            value,
            "write the host on its own. HTTPS is always allowed, "
            "and HTTP as well for localhost and private addresses",
        )

    pattern = parse_host_pattern(value)
    if pattern is None:
        raise InvalidEmbedHost(value, "write a host and an optional port, with no path")

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
