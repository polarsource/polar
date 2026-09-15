from temporalio.client import Client

from polar.config import settings

TASK_QUEUE = settings.VOID_TEMPORAL_TASK_QUEUE


async def connect() -> Client:
    return await Client.connect(
        settings.VOID_TEMPORAL_ADDRESS,
        namespace=settings.VOID_TEMPORAL_NAMESPACE,
        api_key=settings.VOID_TEMPORAL_API_KEY,
        tls=settings.VOID_TEMPORAL_TLS,
    )
