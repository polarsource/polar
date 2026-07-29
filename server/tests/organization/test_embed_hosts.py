import pytest

from polar.organization.embed_hosts import (
    InvalidEmbedHost,
    match_origin,
    parse_origin,
    validate_host_pattern,
)


class TestParseOrigin:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("https://example.com", "https://example.com"),
            ("https://a.b.example.com", "https://a.b.example.com"),
            ("https://example.com/", "https://example.com"),
            ("HTTPS://Example.COM", "https://example.com"),
            ("https://example.com:443", "https://example.com"),
            ("https://example.com:8443", "https://example.com:8443"),
            ("http://localhost:3000", "http://localhost:3000"),
            ("http://127.0.0.1:3000", "http://127.0.0.1:3000"),
            ("https://exämple.com", "https://xn--exmple-cua.com"),
        ],
    )
    def test_origin(self, value: str, expected: str) -> None:
        parsed = parse_origin(value)

        assert parsed is not None
        assert str(parsed) == expected

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("https://example.com/checkout", "https://example.com"),
            ("https://example.com/?verified=true", "https://example.com"),
            ("https://example.com/#/", "https://example.com"),
            ("https://example.com/sales?status=cancelled", "https://example.com"),
            ("https://evil.com@good.com", "https://good.com"),
            ("https://example.com\n", "https://example.com"),
        ],
    )
    def test_reduced_to_origin(self, value: str, expected: str) -> None:
        """`postMessage` compares origins and ignores the rest, so we do too."""
        parsed = parse_origin(value)

        assert parsed is not None
        assert str(parsed) == expected

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("http://example.com", "http://example.com"),
            ("http://192.168.1.43:5500", "http://192.168.1.43:5500"),
            ("http://app.localhost", "http://app.localhost"),
            ("chrome-extension://abcdef", "chrome-extension://abcdef"),
        ],
    )
    def test_non_https_origin(self, value: str, expected: str) -> None:
        """Which schemes may embed is the allowlist's call, not the parser's."""
        parsed = parse_origin(value)

        assert parsed is not None
        assert str(parsed) == expected

    def test_wildcard_host(self) -> None:
        """A wildcard is an allowlist entry, never an origin a browser sends."""
        assert parse_origin("https://*.example.com") is None
        assert parse_origin("https://*") is None

    @pytest.mark.parametrize(
        "value", ["", "*", "null", "file://", "ips-platform-x:3000"]
    )
    def test_no_origin(self, value: str) -> None:
        assert parse_origin(value) is None


class TestValidateHostPattern:
    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("example.com", "example.com"),
            ("*.example.com", "*.example.com"),
            ("EXAMPLE.com", "example.com"),
            ("  example.com  ", "example.com"),
            ("example.com:443", "example.com"),
            ("example.com:8443", "example.com:8443"),
            ("localhost:3000", "localhost:3000"),
            ("192.168.1.43:5500", "192.168.1.43:5500"),
            ("app.localhost", "app.localhost"),
            ("example.local", "example.local"),
            ("chrome-extension://abcdef", "chrome-extension://abcdef"),
            ("*.exämple.com", "*.xn--exmple-cua.com"),
        ],
    )
    def test_normalized(self, value: str, expected: str) -> None:
        assert validate_host_pattern(value) == expected

    @pytest.mark.parametrize(
        "value", ["https://example.com", "http://example.com", "HTTP://example.com"]
    )
    def test_web_scheme_rejected(self, value: str) -> None:
        """The host decides which schemes it admits, so entries never carry one."""
        with pytest.raises(InvalidEmbedHost):
            validate_host_pattern(value)

    @pytest.mark.parametrize(
        "value",
        [
            "",
            "   ",
            "*",
            "*.",
            "*example.com",
            "a.*.com",
            "example.com/path",
            "example.com?a=1",
            "example.com#fragment",
            "example.com\\evil.com",
            "user@example.com",
            "exa mple.com",
            "x" * 260,
        ],
    )
    def test_rejected(self, value: str) -> None:
        with pytest.raises(InvalidEmbedHost):
            validate_host_pattern(value)

    @pytest.mark.parametrize(
        "value",
        [
            "*.vercel.app",
            "*.framer.website",
            "*.framercanvas.com",
            "*.github.io",
            "*.myshopify.com",
            "*.FRAMER.WEBSITE",
            "*.com",
            "*.co.uk",
        ],
    )
    def test_wildcard_on_public_suffix_rejected(self, value: str) -> None:
        """Every subdomain belongs to someone else, so this admits all of them."""
        with pytest.raises(InvalidEmbedHost):
            validate_host_pattern(value)

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("myshop.framer.website", "myshop.framer.website"),
            ("myshop.vercel.app", "myshop.vercel.app"),
            ("*.myshop.framer.website", "*.myshop.framer.website"),
            ("toto.co.uk", "toto.co.uk"),
            ("*.toto.co.uk", "*.toto.co.uk"),
        ],
    )
    def test_own_host_under_public_suffix(self, value: str, expected: str) -> None:
        assert validate_host_pattern(value) == expected

    def test_bare_public_suffix_allowed(self) -> None:
        """It matches that one host and admits nobody else, and a platform selling
        through Polar may serve its own site there."""
        assert validate_host_pattern("framer.website") == "framer.website"


class TestMatchOrigin:
    @pytest.mark.parametrize(
        ("origin", "entry"),
        [
            ("https://example.com", "example.com"),
            ("https://a.example.com", "*.example.com"),
            ("https://a.b.example.com", "*.example.com"),
            ("https://example.com:8443", "example.com:8443"),
            ("https://a.xn--exmple-cua.com", "*.exämple.com"),
            ("chrome-extension://abcdef", "chrome-extension://abcdef"),
        ],
    )
    def test_allowed(self, origin: str, entry: str) -> None:
        assert match_origin(origin, [entry]) == origin

    @pytest.mark.parametrize(
        ("origin", "entry"),
        [
            ("http://localhost:3000", "localhost:3000"),
            ("https://localhost:3000", "localhost:3000"),
            ("http://127.0.0.1:3000", "127.0.0.1:3000"),
            ("http://192.168.1.43:5500", "192.168.1.43:5500"),
            ("http://10.5.0.2:5500", "10.5.0.2:5500"),
            ("http://172.20.0.5:3000", "172.20.0.5:3000"),
            ("http://100.84.68.99:3000", "100.84.68.99:3000"),
            ("http://app.localhost", "app.localhost"),
            ("http://example.local", "example.local"),
        ],
    )
    def test_http_allowed_on_local_host(self, origin: str, entry: str) -> None:
        assert match_origin(origin, [entry]) == origin

    @pytest.mark.parametrize(
        ("origin", "entry"),
        [
            ("https://evil.com", "example.com"),
            ("https://www.example.com", "example.com"),
            ("https://example.com", "*.example.com"),
            ("https://notexample.com", "*.example.com"),
            ("https://example.com:8443", "example.com"),
            ("http://example.com", "example.com"),
            ("http://8.8.8.8:3000", "8.8.8.8:3000"),
            ("https://abcdef", "chrome-extension://abcdef"),
        ],
    )
    def test_refused(self, origin: str, entry: str) -> None:
        assert match_origin(origin, [entry]) is None

    def test_reduced_to_origin(self) -> None:
        assert (
            match_origin("https://www.example.com/checkout", ["*.example.com"])
            == "https://www.example.com"
        )

    def test_empty_allowlist(self) -> None:
        assert match_origin("https://example.com", []) is None
