import asyncio
import json
from typing import Any

import structlog
import typer

from polar.config import settings
from polar.logging import Logger

from ._runner import bootstrap, run_task, shutdown
from ._sqs import actor_to_queue_name, get_queue_url, get_sqs_client, parse_envelope

log: Logger = structlog.get_logger()

cli = typer.Typer()


async def _run_once(actor: str, args: list[Any], kwargs: dict[str, Any]) -> None:
    try:
        await run_task(actor, args, kwargs)
    finally:
        await shutdown()


@cli.command()
def run(actor: str, body: str = typer.Argument("{}")) -> None:
    """Dev one-shot: run one actor from an inline JSON body, bypassing SQS — unlike the Lambda handler, which reads the body from an SQS event."""
    payload = json.loads(body)
    bootstrap()
    asyncio.run(_run_once(actor, payload.get("args", []), payload.get("kwargs", {})))


async def _poll_loop(actors: list[str], max_iterations: int) -> None:
    client = get_sqs_client()
    queue_urls = {a: get_queue_url(client, actor_to_queue_name(a)) for a in actors}
    iterations = 0
    try:
        while max_iterations == 0 or iterations < max_iterations:
            iterations += 1
            for actor_name, url in queue_urls.items():
                response = await asyncio.to_thread(
                    client.receive_message,
                    QueueUrl=url,
                    MaxNumberOfMessages=10,
                    WaitTimeSeconds=2,
                    MessageSystemAttributeNames=["ApproximateReceiveCount"],
                )
                for message in response.get("Messages", []):
                    actor, args, kwargs, correlation_id = parse_envelope(
                        message["Body"]
                    )
                    receive_count = int(
                        message.get("Attributes", {}).get(
                            "ApproximateReceiveCount", "1"
                        )
                    )
                    try:
                        await run_task(
                            actor,
                            args,
                            kwargs,
                            receive_count=receive_count,
                            source_correlation_id=correlation_id,
                        )
                    except Exception:
                        log.error(
                            "polar.worker.sqs_poll_failed", actor=actor, exc_info=True
                        )
                        continue
                    await asyncio.to_thread(
                        client.delete_message,
                        QueueUrl=url,
                        ReceiptHandle=message["ReceiptHandle"],
                    )
    finally:
        await shutdown()


@cli.command()
def poll(
    actor: str | None = typer.Option(None, help="Single actor; defaults to allowlist"),
    max_iterations: int = typer.Option(0, help="0 = loop forever"),
) -> None:
    """Local dev consumer: drain SQS through run_task without building the Lambda image."""
    actors = [actor] if actor else sorted(settings.WORKER_SQS_ACTORS)
    bootstrap()
    asyncio.run(_poll_loop(actors, max_iterations))


if __name__ == "__main__":
    cli()
