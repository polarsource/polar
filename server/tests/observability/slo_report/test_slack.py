from datetime import UTC, datetime

from polar.observability.slo_report.schemas import SLOReport
from polar.observability.slo_report.slack import format_slo_report_slack_payload


class TestFormatSLOReportSlackPayload:
    def test_incomplete_report(self) -> None:
        report = SLOReport(
            period_start=datetime(2026, 10, 19, tzinfo=UTC),
            period_end=datetime(2026, 10, 26, tzinfo=UTC),
            environment="production",
            global_availability=None,
            error_budget_remaining=99.0,
            total_requests=100,
            total_errors=0,
            endpoints=[],
            failed_queries=["Global availability", "Endpoint P99 latency"],
        )

        payload = format_slo_report_slack_payload(report)

        texts = [b["text"]["text"] for b in payload["blocks"] if "text" in b]
        assert texts[0].startswith(":warning:")
        assert any(
            "Incomplete report" in t
            and "Global availability, Endpoint P99 latency" in t
            for t in texts
        )
        assert any("*Global Availability:* N/A" in t for t in texts)
