from enum import StrEnum
from typing import TYPE_CHECKING

import boto3
import typer
from botocore.config import Config

if TYPE_CHECKING:
    from mypy_boto3_sqs.client import SQSClient
    from mypy_boto3_sqs.type_defs import ListMessageMoveTasksResultEntryTypeDef

cli = typer.Typer()


class Env(StrEnum):
    production = "production"
    sandbox = "sandbox"
    test = "test"


def get_client(region: str) -> "SQSClient":
    return boto3.client("sqs", config=Config(region_name=region))


def get_dlq_urls(client: "SQSClient", env: Env) -> dict[str, str]:
    prefix = f"polar-{env.value}-tasks"
    urls: list[str] = []
    next_token: str | None = None
    while True:
        response = client.list_queues(
            QueueNamePrefix=prefix,
            MaxResults=1000,
            **({"NextToken": next_token} if next_token else {}),
        )
        urls.extend(response.get("QueueUrls", []))
        next_token = response.get("NextToken")
        if next_token is None:
            break
    return {url.rsplit("/", 1)[1]: url for url in urls if url.endswith("-dlq")}


def get_queue_arn_and_depth(client: "SQSClient", queue_url: str) -> tuple[str, int]:
    attributes = client.get_queue_attributes(
        QueueUrl=queue_url,
        AttributeNames=["QueueArn", "ApproximateNumberOfMessages"],
    )["Attributes"]
    return attributes["QueueArn"], int(attributes["ApproximateNumberOfMessages"])


def get_latest_move_task(
    client: "SQSClient", source_arn: str
) -> "ListMessageMoveTasksResultEntryTypeDef | None":
    results = client.list_message_move_tasks(SourceArn=source_arn, MaxResults=1).get(
        "Results", []
    )
    return results[0] if results else None


def resolve_dlq(client: "SQSClient", env: Env, queue: str) -> tuple[str, str]:
    name = f"polar-{env.value}-tasks-{queue}-dlq"
    dlq_urls = get_dlq_urls(client, env)
    if name not in dlq_urls:
        typer.echo(f"No DLQ named {name}. Available: {', '.join(sorted(dlq_urls))}")
        raise typer.Exit(1)
    return name, dlq_urls[name]


@cli.command("list")
def list_dlqs(env: Env, region: str = typer.Option("us-east-2", "--region")) -> None:
    client = get_client(region)
    dlq_urls = get_dlq_urls(client, env)
    if not dlq_urls:
        typer.echo(f"No DLQs found for {env.value}")
        raise typer.Exit(1)
    for name, url in sorted(dlq_urls.items()):
        arn, depth = get_queue_arn_and_depth(client, url)
        line = f"{name}: {depth} message(s)"
        task = get_latest_move_task(client, arn)
        if task is not None:
            moved = task.get("ApproximateNumberOfMessagesMoved", 0)
            total = task.get("ApproximateNumberOfMessagesToMove", 0)
            line += f" — last redrive {task['Status']} ({moved}/{total} moved)"
            if task.get("FailureReason"):
                line += f" [{task['FailureReason']}]"
        typer.echo(line)


@cli.command()
def redrive(
    env: Env,
    queue: str = typer.Argument(help="Short queue name (e.g. webhooks), or 'all'"),
    rate: int | None = typer.Option(None, "--rate", min=1, max=500),
    region: str = typer.Option("us-east-2", "--region"),
) -> None:
    client = get_client(region)
    if queue == "all":
        targets = get_dlq_urls(client, env)
    else:
        targets = dict([resolve_dlq(client, env, queue)])
    for name, url in sorted(targets.items()):
        arn, depth = get_queue_arn_and_depth(client, url)
        if depth == 0:
            typer.echo(f"{name}: empty, skipping")
            continue
        task = get_latest_move_task(client, arn)
        if task is not None and task["Status"] == "RUNNING":
            typer.echo(f"{name}: redrive already running, skipping")
            continue
        if rate is not None:
            client.start_message_move_task(
                SourceArn=arn, MaxNumberOfMessagesPerSecond=rate
            )
        else:
            client.start_message_move_task(SourceArn=arn)
        typer.echo(f"{name}: redrive started for {depth} message(s)")


@cli.command()
def cancel(
    env: Env,
    queue: str,
    region: str = typer.Option("us-east-2", "--region"),
) -> None:
    client = get_client(region)
    name, url = resolve_dlq(client, env, queue)
    arn, _ = get_queue_arn_and_depth(client, url)
    task = get_latest_move_task(client, arn)
    if task is None or task["Status"] != "RUNNING":
        typer.echo(f"{name}: no running redrive")
        raise typer.Exit(1)
    client.cancel_message_move_task(TaskHandle=task["TaskHandle"])
    typer.echo(f"{name}: redrive cancelled")


if __name__ == "__main__":
    cli()
