from fastapi import WebSocket

from polar.openapi import APITag
from polar.routing import APIRouter

router = APIRouter(prefix="/outpost", tags=["outpost", APITag.private])


@router.websocket("/")
async def outpost(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_text("Hello, Outpost!")
    await websocket.close()
