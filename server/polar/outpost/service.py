import structlog
from anyio.streams.memory import MemoryObjectSendStream
from pydantic import ValidationError

from polar.logging import Logger
from polar.meter.repository import MeterRepository
from polar.models import Organization
from polar.postgres import AsyncSession

from .schemas import (
    IncomingMessageAdapter,
    IncomingMessageType,
    OutgoingMessage,
    OutgoingMessageAdapter,
    OutgoingMessageType,
)

log: Logger = structlog.get_logger(__name__)


class OutpostService:
    async def handle_incoming_message(
        self,
        session: AsyncSession,
        organization: Organization,
        payload: str,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        try:
            incoming = IncomingMessageAdapter.validate_json(payload)
        except ValidationError:
            log.warning("Invalid incoming message")
            return

        match incoming.type:
            case IncomingMessageType.configuration:
                return await self.send_configuration(session, organization, send_stream)

    async def send_configuration(
        self,
        session: AsyncSession,
        organization: Organization,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        meter_repository = MeterRepository.from_session(session)
        meters = await meter_repository.get_all_active_by_organization(organization.id)
        message = OutgoingMessageAdapter.validate_python(
            {"type": OutgoingMessageType.configuration, "payload": {"meters": meters}}
        )
        await send_stream.send(message)


outpost = OutpostService()
