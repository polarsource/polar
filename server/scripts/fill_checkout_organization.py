import asyncio
import logging.config
from functools import wraps
from typing import Any

import structlog
import typer
from rich.progress import Progress
from sqlalchemy import bindparam, func, select, update

from polar import tasks  # noqa: F401
from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Checkout, Product
from polar.postgres import create_async_engine

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def fill_checkout_organization(batch_size: int = typer.Option(1000)) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        count_statement = select(func.count(Checkout.id)).where(
            Checkout.organization_id.is_(None)
        )
        total_result = await session.execute(count_statement)
        total = total_result.scalar_one()

        statement = (
            select(Checkout.id, Product.organization_id)
            .join(Product, Checkout.product_id == Product.id)
            .where(Checkout.organization_id.is_(None))
            .order_by(Checkout.created_at.desc())
        )
        batch: list[dict[str, Any]] = []

        results = await session.stream(
            statement,
            execution_options={"yield_per": settings.DATABASE_STREAM_YIELD_PER},
        )
        with Progress() as progress:
            task = progress.add_task(
                "[green]Filling Checkout.organization_id...", total=total
            )
            async for result in results:
                checkout_id, organization_id = result._tuple()
                batch.append({"c_id": checkout_id, "organization_id": organization_id})

                if len(batch) >= batch_size:
                    async with sessionmaker() as update_session:
                        connection = await update_session.connection()
                        await connection.execute(
                            update(Checkout).where(Checkout.id == bindparam("c_id")),
                            batch,
                        )
                        await update_session.commit()
                        progress.advance(task, len(batch))
                        batch = []

            if batch:
                async with sessionmaker() as update_session:
                    connection = await update_session.connection()
                    await connection.execute(
                        update(Checkout).where(Checkout.id == bindparam("c_id")), batch
                    )
                    await update_session.commit()
                    progress.advance(task, len(batch))
                    batch = []


if __name__ == "__main__":
    cli()
