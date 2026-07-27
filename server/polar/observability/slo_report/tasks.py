"""
Scheduled task for weekly SLO report.

Runs every Monday at 9 AM UTC and sends the report to Slack.
"""

import httpx
import structlog

from polar.config import Environment, settings
from polar.integrations.slack.client import SlackClient
from polar.logging import Logger
from polar.worker import CronTrigger, TaskPriority, actor

from .client import GrafanaCloudAPIError, GrafanaCloudConfigError
from .service import slo_report_service
from .slack import format_slo_report_slack_payload

log: Logger = structlog.get_logger()

_slack_client = SlackClient()


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
        await _slack_client.chat_post_message(
            bot_token=bot_token, channel=channel, **payload
        )

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
