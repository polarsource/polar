from opentelemetry import baggage as otel_baggage

from polar.observability.baggage import organization_baggage


class TestOrganizationBaggage:
    def test_attaches_both_values(self) -> None:
        with organization_baggage(
            organization_id="org-123",
            organization_slug="acme",
        ):
            assert otel_baggage.get_baggage("organization_id") == "org-123"
            assert otel_baggage.get_baggage("organization_slug") == "acme"

    def test_skips_none_values(self) -> None:
        with organization_baggage(organization_id="org-123", organization_slug=None):
            assert otel_baggage.get_baggage("organization_id") == "org-123"
            assert otel_baggage.get_baggage("organization_slug") is None

    def test_no_args_is_noop(self) -> None:
        with organization_baggage():
            assert otel_baggage.get_baggage("organization_id") is None
            assert otel_baggage.get_baggage("organization_slug") is None

    def test_clears_on_exit(self) -> None:
        with organization_baggage(organization_id="org-123"):
            pass
        assert otel_baggage.get_baggage("organization_id") is None
