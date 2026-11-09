from datetime import UTC, datetime

from polar.observability.slo_report.report import EndpointSLOStatus, SLOReport
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
            and "no data for global availability." in t
            for t in texts
        )
        assert any("*Global Availability:* N/A" in t for t in texts)

    def test_endpoint_without_data(self) -> None:
        report = SLOReport(
            period_start=datetime(2026, 10, 19, tzinfo=UTC),
            period_end=datetime(2026, 10, 26, tzinfo=UTC),
            environment="production",
            global_availability=100.0,
            error_budget_remaining=100.0,
            total_requests=100,
            total_errors=0,
            endpoints=[
                EndpointSLOStatus(
                    endpoint="/v1/checkouts/{id}",
                    method="GET",
                    p99_target=0.3,
                    p99_actual=None,
                    availability_target=99.95,
                    availability_actual=None,
                    request_count=0,
                    error_count=0,
                )
            ],
        )

        payload = format_slo_report_slack_payload(report)

        assert report.overall_status == "incomplete"
        texts = [b["text"]["text"] for b in payload["blocks"] if "text" in b]
        assert any("no data for `GET /v1/checkouts/{id}`" in t for t in texts)
        assert any("*Critical Endpoints:* 0/1 passing" == t for t in texts)
        assert any(
            t.startswith("*Endpoints Without Data:*\n:grey_question: `GET")
            for t in texts
        )
        assert not any(t.startswith("*Healthy Endpoints:*") for t in texts)

    def test_missing_global_metrics(self) -> None:
        report = SLOReport(
            period_start=datetime(2026, 10, 19, tzinfo=UTC),
            period_end=datetime(2026, 10, 26, tzinfo=UTC),
            environment="production",
            global_availability=None,
            error_budget_remaining=None,
            total_requests=0,
            total_errors=0,
            endpoints=[],
        )

        payload = format_slo_report_slack_payload(report)

        assert report.overall_status == "incomplete"
        texts = [b["text"]["text"] for b in payload["blocks"] if "text" in b]
        assert any("no data for global availability, error budget." in t for t in texts)
