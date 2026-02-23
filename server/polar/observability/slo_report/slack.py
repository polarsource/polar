"""
Slack message formatting for SLO reports.

Uses Slack Block Kit for rich formatting:
https://api.slack.com/block-kit
"""

from typing import Any

from polar.webhook.slack import SlackPayload, get_branded_slack_payload

from .schemas import SLOReport


def _status_emoji(passing: bool) -> str:
    """Return status emoji."""
    return ":white_check_mark:" if passing else ":x:"


def _overall_status_emoji(status: str) -> str:
    """Return overall status emoji based on report status."""
    return {
        "healthy": ":large_green_circle:",
        "degraded": ":large_yellow_circle:",
        "critical": ":red_circle:",
    }.get(status, ":grey_question:")


def _format_percentage(value: float | None, default: str = "N/A") -> str:
    """Format percentage value."""
    if value is None:
        return default
    return f"{value:.2f}%"


def _format_duration(seconds: float | None, default: str = "N/A") -> str:
    """Format duration in human-readable format."""
    if seconds is None:
        return default
    if seconds < 1:
        return f"{seconds * 1000:.0f}ms"
    return f"{seconds:.2f}s"


def _format_number(value: int) -> str:
    """Format large numbers with commas."""
    return f"{value:,}"


def format_slo_report_slack_payload(report: SLOReport) -> SlackPayload:
    """
    Format SLO report as Slack Block Kit message.

    Structure:
    - Header with status and date range
    - Summary stats (availability, error budget, requests)
    - Failing endpoints section (if any)
    - Passing endpoints section (compact)
    """
    blocks: list[dict[str, Any]] = []

    # Header
    status_emoji = _overall_status_emoji(report.overall_status)
    period_str = (
        f"{report.period_start.strftime('%b %d')} - "
        f"{report.period_end.strftime('%b %d, %Y')}"
    )

    blocks.append(
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{status_emoji} Weekly SLO Report - {report.environment.title()}",
                "emoji": True,
            },
        }
    )

    blocks.append(
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"*Period:* {period_str}"},
            ],
        }
    )

    blocks.append({"type": "divider"})

    # Summary section
    summary_text = (
        f"*Global Availability:* {_format_percentage(report.global_availability)} "
        f"(Target: 99.95%)\n"
        f"*Error Budget Remaining:* {_format_percentage(report.error_budget_remaining)}\n"
        f"*Total Requests:* {_format_number(report.total_requests)} | "
        f"*Errors:* {_format_number(report.total_errors)}"
    )

    blocks.append(
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": summary_text},
        }
    )

    # SLO Status Summary
    passing_count = report.endpoints_passing
    failing_count = report.endpoints_failing
    total_count = len(report.endpoints)

    status_text = f"*Critical Endpoints:* {passing_count}/{total_count} passing"
    if failing_count > 0:
        status_text += f" | *{failing_count} failing*"

    blocks.append(
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": status_text},
        }
    )

    blocks.append({"type": "divider"})

    # Failing endpoints (detailed)
    failing_endpoints = [e for e in report.endpoints if not e.is_passing]
    if failing_endpoints:
        blocks.append(
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": ":warning: *Endpoints Breaching SLO:*",
                },
            }
        )

        for endpoint in failing_endpoints:
            p99_status = _status_emoji(endpoint.p99_passing)
            avail_status = _status_emoji(endpoint.availability_passing)

            endpoint_text = (
                f"*`{endpoint.method} {endpoint.endpoint}`*\n"
                f"{p99_status} P99: {_format_duration(endpoint.p99_actual)} "
                f"(target: {_format_duration(endpoint.p99_target)})\n"
                f"{avail_status} Availability: {_format_percentage(endpoint.availability_actual)} "
                f"(target: {_format_percentage(endpoint.availability_target)})\n"
                f"Requests: {_format_number(endpoint.request_count)} | "
                f"Errors: {_format_number(endpoint.error_count)}"
            )

            blocks.append(
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": endpoint_text},
                }
            )

        blocks.append({"type": "divider"})

    # Passing endpoints (compact summary)
    passing_endpoints = [e for e in report.endpoints if e.is_passing]
    if passing_endpoints:
        passing_list = "\n".join(
            f":white_check_mark: `{e.method} {e.endpoint}` "
            f"- P99: {_format_duration(e.p99_actual)}, "
            f"Avail: {_format_percentage(e.availability_actual)}"
            for e in passing_endpoints
        )

        blocks.append(
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Healthy Endpoints:*\n{passing_list}",
                },
            }
        )

    # Build payload with fallback text
    fallback_text = (
        f"Weekly SLO Report ({report.environment}): "
        f"{passing_count}/{total_count} endpoints passing, "
        f"Availability: {_format_percentage(report.global_availability)}"
    )

    payload: SlackPayload = {"text": fallback_text, "blocks": blocks}
    return get_branded_slack_payload(payload)
