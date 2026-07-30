from datetime import UTC, datetime

import pytest

from polar.organization.embed_hosts import (
    InvalidEmbedHost,
    is_shared_host,
    match_origin,
    parse_origin,
    uncovered_hosts,
    validate_host_pattern,
)

SEEN = datetime(2026, 1, 1, tzinfo=UTC)
LATER = datetime(2026, 2, 1, tzinfo=UTC)


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

    @pytest.mark.parametrize("value", ["*.com", "*.co.uk", "*.CO.UK", "*.io"])
    def test_wildcard_on_registry_suffix_rejected(self, value: str) -> None:
        """No site sits directly under a registry suffix, so this is a slip."""
        with pytest.raises(InvalidEmbedHost):
            validate_host_pattern(value)

    @pytest.mark.parametrize(
        ("value", "expected"),
        [
            ("*.vercel.app", "*.vercel.app"),
            ("*.framer.website", "*.framer.website"),
            ("*.FRAMER.WEBSITE", "*.framer.website"),
        ],
    )
    def test_wildcard_on_platform_accepted(self, value: str, expected: str) -> None:
        """Preview deployments get a fresh host each time, so it's the only way
        to embed from them. Settings warns rather than refusing."""
        assert validate_host_pattern(value) == expected

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


class TestUncoveredHosts:
    def test_host_the_allowlist_admits_is_left_out(self) -> None:
        observed = [("https://example.com", 3, SEEN)]

        assert uncovered_hosts(observed, ["example.com"]) == []
        assert uncovered_hosts(observed, ["*.example.com"]) != []

    def test_suggests_the_entry_admitting_the_origin(self) -> None:
        observed = [
            ("https://myshop.framer.website", 2, SEEN),
            ("http://localhost:3000", 1, SEEN),
            ("chrome-extension://abcdef", 1, SEEN),
        ]

        assert {host.host for host in uncovered_hosts(observed, [])} == {
            "myshop.framer.website",
            "localhost:3000",
            "chrome-extension://abcdef",
        }

    def test_public_http_host_cannot_be_listed(self) -> None:
        """Whatever we allowed, the token would still cross the network in clear."""
        assert uncovered_hosts([("http://example.com", 9, SEEN)], []) == []

    def test_paths_collapse_onto_one_host(self) -> None:
        observed = [
            ("https://example.com/checkout", 2, SEEN),
            ("https://example.com/pricing", 3, LATER),
        ]

        (host,) = uncovered_hosts(observed, [])
        assert host.host == "example.com"
        assert host.checkouts == 5
        assert host.last_seen_at == LATER

    def test_ordered_by_volume(self) -> None:
        observed = [("https://quiet.com", 1, SEEN), ("https://busy.com", 50, SEEN)]

        assert [host.host for host in uncovered_hosts(observed, [])] == [
            "busy.com",
            "quiet.com",
        ]

    def test_equal_volume_ordered_by_host(self) -> None:
        """The query groups without ordering, so ties must not follow the rows."""
        observed = [
            ("https://gamma.com", 2, SEEN),
            ("https://alpha.com", 2, SEEN),
            ("https://beta.com", 2, SEEN),
        ]

        assert [host.host for host in uncovered_hosts(observed, [])] == [
            "alpha.com",
            "beta.com",
            "gamma.com",
        ]
        assert uncovered_hosts(observed, []) == uncovered_hosts(
            list(reversed(observed)), []
        )

    def test_origin_carrying_none_is_dropped(self) -> None:
        assert uncovered_hosts([("null", 4, SEEN)], []) == []


class TestIsSharedHost:
    @pytest.mark.parametrize(
        "entry", ["*.vercel.app", "*.framer.website", "*.framercanvas.com"]
    )
    def test_platform_wildcard(self, entry: str) -> None:
        assert is_shared_host(entry) is True

    @pytest.mark.parametrize(
        "entry",
        [
            "*.example.com",
            "*.myshop.vercel.app",
            "myshop.vercel.app",
            "vercel.app",
            "example.com",
            "chrome-extension://abcdef",
            "not a host",
        ],
    )
    def test_everything_else(self, entry: str) -> None:
        assert is_shared_host(entry) is False
