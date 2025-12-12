import asyncio
from datetime import UTC, datetime

from fastapi import WebSocket, WebSocketDisconnect

from polar.routing import APIRouter

router = APIRouter(prefix="/cli", tags=["cli"])

@router.websocket("/listen")
async def listen(websocket: WebSocket) -> None:
    await websocket.accept()

    try:
        while True:
            message = {
                "timestamp": datetime.now(UTC).isoformat(),
                "status": "ok",
                "message": "Periodic update from Polar CLI"
            }

            await websocket.send_json(message)
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        pass
