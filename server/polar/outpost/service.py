import uuid

import structlog
from anyio.streams.memory import MemoryObjectSendStream
from pydantic import ValidationError

from polar.customer_meter.repository import CustomerMeterRepository
from polar.logging import Logger
from polar.meter.repository import MeterRepository
from polar.models import Organization
from polar.postgres import AsyncSession

from .schemas import (
    CustomerMeterOutgoingMessage,
    CustomerMeterOutgoingMessagePayload,
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
            case IncomingMessageType.customer_meter:
                return await self.send_customer_meter(
                    session,
                    organization,
                    incoming.payload.customer_id,
                    incoming.payload.meter_id,
                    send_stream,
                )

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

    async def send_customer_meter(
        self,
        session: AsyncSession,
        organization: Organization,
        customer_id: uuid.UUID,
        meter_id: uuid.UUID,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        customer_meter_repository = CustomerMeterRepository.from_session(session)
        customer_meter = (
            await customer_meter_repository.get_by_organization_customer_and_meter(
                organization.id, customer_id, meter_id
            )
        )
        if customer_meter is None:
            log.warning(
                "Customer meter not found",
                organization_id=organization.id,
                customer_id=customer_id,
                meter_id=meter_id,
            )
            return

        message = CustomerMeterOutgoingMessage(
            type=OutgoingMessageType.customer_meter,
            payload=CustomerMeterOutgoingMessagePayload.model_validate(customer_meter),
        )
        await send_stream.send(message)


outpost = OutpostService()
