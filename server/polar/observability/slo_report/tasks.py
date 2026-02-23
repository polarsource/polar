"""
Scheduled task for weekly SLO report.

Runs every Monday at 9 AM UTC and sends the report to Slack.
"""

import httpx
import structlog

from polar.config import Environment, settings
from polar.logging import Logger
from polar.webhook.slack import SlackPayload
from polar.worker import CronTrigger, TaskPriority, actor

from .client import GrafanaCloudAPIError, GrafanaCloudConfigError
from .service import slo_report_service
from .slack import format_slo_report_slack_payload

log: Logger = structlog.get_logger()

SLACK_API_URL = "https://slack.com/api/chat.postMessage"


async def _send_slack_message(payload: SlackPayload, token: str, channel: str) -> None:
    """Send message to Slack via chat.postMessage API."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            SLACK_API_URL,
            headers={"Authorization": f"Bearer {token}"},
            json={**payload, "channel": channel},
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        if not data.get("ok"):
            error_code = data.get("error", "unknown")
            raise RuntimeError(f"Slack API error: {error_code}")
        log.info("slo_report_sent_to_slack", channel=channel)


@actor(
    actor_name="slo_report.send_weekly",
    cron_trigger=CronTrigger(day_of_week="mon", hour=9, minute=0),
    priority=TaskPriority.LOW,
)
async def slo_report_send_weekly() -> None:
    """
    Generate and send weekly SLO report to Slack.

    This task runs every Monday at 9 AM UTC.
    """
    if settings.ENV != Environment.production:
        log.info("slo_report_skipped_non_production", env=settings.ENV)
        return

    if not settings.SLO_REPORT_ENABLED:
        log.info("slo_report_disabled")
        return

    bot_token = settings.SLACK_BOT_TOKEN
    channel = settings.SLACK_CHANNEL
    if not bot_token or not channel:
        log.warning("slo_report_slack_not_configured")
        return

    if not settings.GRAFANA_CLOUD_PROMETHEUS_QUERY_URL:
        log.warning("slo_report_grafana_not_configured")
        return

    log.info("slo_report_generating")

    try:
        report = await slo_report_service.generate_report()

        log.info(
            "slo_report_generated",
            environment=report.environment,
            global_availability=report.global_availability,
            error_budget_remaining=report.error_budget_remaining,
            endpoints_passing=report.endpoints_passing,
            endpoints_failing=report.endpoints_failing,
        )

        payload = format_slo_report_slack_payload(report)
        await _send_slack_message(payload, bot_token, channel)

    except GrafanaCloudConfigError as e:
        log.error("slo_report_config_error", error=str(e))
        raise
    except GrafanaCloudAPIError as e:
        log.error("slo_report_grafana_error", error=str(e))
        raise
    except httpx.HTTPStatusError as e:
        log.error(
            "slo_report_slack_error",
            status_code=e.response.status_code,
        )
        raise
    except httpx.HTTPError:
        log.error("slo_report_slack_error")
        raise
    except Exception as e:
        log.error("slo_report_error", error=str(e), error_type=type(e).__name__)
        raise
    finally:
        await slo_report_service.close()
