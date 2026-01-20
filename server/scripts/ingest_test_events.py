import random
import time

import httpx
import typer
from rich.progress import track

cli = typer.Typer()


@cli.command()
def ingest_test_events(
    api_key: str,
    external_customer_id: str,
    batch_size: int = typer.Option(10),
    batch_count: int = typer.Option(10),
    delay: float = typer.Option(0.1),
    base_url: str = typer.Option("http://127.0.0.1:8000/v1/"),
) -> None:
    with httpx.Client(
        base_url=base_url, headers={"Authorization": f"Bearer {api_key}"}
    ) as client:
        for _ in track(range(batch_count), description="Ingesting..."):
            response = client.post(
                "/events/ingest",
                json={
                    "events": [
                        {
                            "name": "ai_usage",
                            "external_customer_id": external_customer_id,
                            "metadata": {"tokens": random.randint(1, 1000)},
                        }
                        for _ in range(batch_size)
                    ]
                },
            )
            response.raise_for_status()
            time.sleep(delay)


if __name__ == "__main__":
    cli()
