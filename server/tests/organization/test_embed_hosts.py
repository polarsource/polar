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
            ("https://example.com/laserHinge", "https://example.com"),
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
            ("http://tauri.localhost", "http://tauri.localhost"),
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
            ("https://example.com", "example.com"),
            ("example.com:443", "example.com"),
            ("example.com:8443", "example.com:8443"),
            ("localhost:3000", "localhost:3000"),
            ("http://localhost:3000", "http://localhost:3000"),
            ("http://192.168.1.43:5500", "http://192.168.1.43:5500"),
            ("chrome-extension://abcdef", "chrome-extension://abcdef"),
            ("*.exämple.com", "*.xn--exmple-cua.com"),
        ],
    )
    def test_normalized(self, value: str, expected: str) -> None:
        assert validate_host_pattern(value) == expected

    @pytest.mark.parametrize(
        "value",
        [
            "",
            "   ",
            "*",
            "*.",
            "https://*",
            "*example.com",
            "a.*.com",
            "example.com/path",
            "example.com?a=1",
            "example.com#fragment",
            "example.com\\evil.com",
            "user@example.com",
            "https://evil.com@good.com",
            "exa mple.com",
            "x" * 260,
        ],
    )
    def test_rejected(self, value: str) -> None:
        with pytest.raises(InvalidEmbedHost):
            validate_host_pattern(value)


class TestMatchOrigin:
    @pytest.mark.parametrize(
        ("origin", "entry"),
        [
            ("https://example.com", "example.com"),
            ("https://a.example.com", "*.example.com"),
            ("https://a.b.example.com", "*.example.com"),
            ("https://example.com:8443", "example.com:8443"),
            ("http://localhost:3000", "http://localhost:3000"),
            ("https://a.xn--exmple-cua.com", "*.exämple.com"),
            ("chrome-extension://abcdef", "chrome-extension://abcdef"),
        ],
    )
    def test_allowed(self, origin: str, entry: str) -> None:
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
            ("http://localhost:3000", "localhost:3000"),
        ],
    )
    def test_refused(self, origin: str, entry: str) -> None:
        assert match_origin(origin, [entry]) is None

    def test_reduced_to_origin(self) -> None:
        assert (
            match_origin("https://www.makercase.com/laserHinge", ["*.makercase.com"])
            == "https://www.makercase.com"
        )

    def test_empty_allowlist(self) -> None:
        assert match_origin("https://example.com", []) is None
