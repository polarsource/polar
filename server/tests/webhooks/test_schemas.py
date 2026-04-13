import pytest

from polar.webhook.schemas import is_blocked_webhook_host


class TestIsBlockedWebhookHost:
    # --- Localhost ---

    @pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"])
    def test_blocks_localhost_variants(self, host: str) -> None:
        assert is_blocked_webhook_host(host) is True

    def test_blocks_localhost_case_insensitive(self) -> None:
        assert is_blocked_webhook_host("LOCALHOST") is True
        assert is_blocked_webhook_host("Localhost") is True

    # --- Private IPv4 ---

    @pytest.mark.parametrize(
        "ip",
        [
            "10.0.0.1",
            "172.16.0.1",
            "192.168.1.1",
            "169.254.0.1",
            "100.64.0.1",
        ],
    )
    def test_blocks_private_ipv4(self, ip: str) -> None:
        assert is_blocked_webhook_host(ip) is True

    # --- Private IPv6 ---

    @pytest.mark.parametrize("ip", ["fc00::1", "fd00::1", "fe80::1", "::1"])
    def test_blocks_private_ipv6(self, ip: str) -> None:
        assert is_blocked_webhook_host(ip) is True

    def test_blocks_bracketed_ipv6(self) -> None:
        assert is_blocked_webhook_host("[fc00::1]") is True
        assert is_blocked_webhook_host("[::1]") is True

    # --- Public IPs ---

    @pytest.mark.parametrize("ip", ["8.8.8.8", "216.150.1.1", "1.1.1.1"])
    def test_allows_public_ipv4(self, ip: str) -> None:
        assert is_blocked_webhook_host(ip) is False

    # --- Domain names (must never be blocked) ---

    def test_allows_regular_domains(self) -> None:
        assert is_blocked_webhook_host("example.com") is False
        assert is_blocked_webhook_host("api.polar.sh") is False
        assert is_blocked_webhook_host("webhook.site") is False

    def test_allows_domains_starting_with_fc_or_fd(self) -> None:
        """Regression test: fc/fd prefixes must not be confused with IPv6 ULA."""
        assert is_blocked_webhook_host("fctactix.com") is False
        assert is_blocked_webhook_host("fcexample.com") is False
        assert is_blocked_webhook_host("fdomain.example.com") is False
        assert is_blocked_webhook_host("fd-service.io") is False

    def test_allows_subdomains_of_fc_domains(self) -> None:
        assert is_blocked_webhook_host("staging.fctactix.com") is False
        assert is_blocked_webhook_host("hooks.fctactix.com") is False
