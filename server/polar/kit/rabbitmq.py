import contextlib
from collections.abc import AsyncGenerator
from typing import Literal

import aio_pika
import aio_pika.abc

from polar.config import settings

type RabbitMQConnection = aio_pika.abc.AbstractRobustConnection

type ProcessName = Literal["app", "worker", "script"]


@contextlib.asynccontextmanager
async def get_rabbitmq(
    process_name: ProcessName,
) -> AsyncGenerator[RabbitMQConnection]:
    connection = await aio_pika.connect_robust(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        login=settings.RABBITMQ_USER,
        password=settings.RABBITMQ_PWD,
        client_properties={
            "name": f"{settings.ENV.value}.{process_name}",  # See: https://github.com/mosquito/aio-pika/issues/642
        },
    )
    async with connection:
        yield connection
    await connection.close()


__all__ = [
    "RabbitMQConnection",
    "get_rabbitmq",
]
