import structlog
from anyio.streams.memory import MemoryObjectSendStream
from pydantic import ValidationError
from sqlalchemy.orm import joinedload, selectinload

from polar.customer_meter.repository import CustomerMeterRepository
from polar.kit.db.postgres import AsyncReadSession
from polar.logging import Logger
from polar.meter.repository import MeterRepository
from polar.models import CustomerMeter, Organization, Reducer
from polar.reducer.repository import ReducerRepository

from .schemas import (
    CustomerMeterIncomingMessageCustomerPayload,
    CustomerMeterIncomingMessagePayload,
    CustomerMeterOutgoingMessage,
    CustomerMeterOutgoingMessagePayload,
    IncomingMessageAdapter,
    IncomingMessageType,
    OutgoingMessage,
    OutgoingMessageAdapter,
    OutgoingMessageType,
)
from .stream import OutpostEvent

log: Logger = structlog.get_logger(__name__)


class OutpostService:
    async def handle_incoming_message(
        self,
        session: AsyncReadSession,
        organization: Organization,
        payload: str,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        try:
            incoming = IncomingMessageAdapter.validate_json(payload)
        except ValidationError:
            log.warning("Invalid incoming message")
            return

        log.debug("Handling incoming message", type=incoming.type)

        match incoming.type:
            case IncomingMessageType.configuration:
                return await self._send_configuration(
                    session, organization, send_stream
                )
            case IncomingMessageType.customer_meter:
                return await self._send_customer_meter(
                    session, organization, incoming.payload, send_stream
                )

    async def handle_event(
        self,
        session: AsyncReadSession,
        organization: Organization,
        event: OutpostEvent,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        log.debug("Handling event", type=event["type"])
        match event["type"]:
            case "customer_meter":
                return await self._send_customer_meter(
                    session,
                    organization,
                    CustomerMeterIncomingMessageCustomerPayload(
                        customer_id=event["customer_id"], meter_id=event["meter_id"]
                    ),
                    send_stream,
                )

    async def _send_configuration(
        self,
        session: AsyncReadSession,
        organization: Organization,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        meter_repository = MeterRepository.from_session(session)
        meters = await meter_repository.get_all_active_by_organization(organization.id)
        reducer_repository = ReducerRepository.from_session(session)
        reducers = await reducer_repository.get_all_active_by_organization(
            organization.id, options=(selectinload(Reducer.meter_reducers),)
        )
        message = OutgoingMessageAdapter.validate_python(
            {
                "type": OutgoingMessageType.configuration,
                "payload": {"meters": meters, "reducers": reducers},
            }
        )
        await send_stream.send(message)

    async def _send_customer_meter(
        self,
        session: AsyncReadSession,
        organization: Organization,
        payload: CustomerMeterIncomingMessagePayload,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        customer_meter_repository = CustomerMeterRepository.from_session(session)
        options = (joinedload(CustomerMeter.last_balanced_event),)
        if isinstance(payload, CustomerMeterIncomingMessageCustomerPayload):
            customer_meter = (
                await customer_meter_repository.get_by_organization_customer_and_meter(
                    organization.id,
                    payload.customer_id,
                    payload.meter_id,
                    options=options,
                )
            )
        else:
            customer_meter = await customer_meter_repository.get_by_organization_external_customer_and_meter(
                organization.id,
                payload.external_customer_id,
                payload.meter_id,
                options=options,
            )
        if customer_meter is None:
            log.warning(
                "Customer meter not found",
                organization_id=organization.id,
                **payload.model_dump(),
            )
            return

        message = CustomerMeterOutgoingMessage(
            type=OutgoingMessageType.customer_meter,
            payload=CustomerMeterOutgoingMessagePayload.model_validate(customer_meter),
        )
        await send_stream.send(message)


outpost = OutpostService()
