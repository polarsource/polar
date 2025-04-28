from polar.worker import RedisMiddleware, actor

from .service import send_event


@actor(actor_name="eventstream.publish")
async def eventstream_publish(event: str, channels: list[str]) -> None:
    await send_event(RedisMiddleware.get(), event, channels)
