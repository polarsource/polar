from datetime import datetime

import structlog
from anyio.streams.memory import MemoryObjectSendStream
from pydantic import ValidationError
from sqlalchemy.orm import selectinload

from polar.customer_meter.repository import CustomerMeterRepository
from polar.kit.db.postgres import AsyncReadSession
from polar.logging import Logger
from polar.models import Organization, Reducer
from polar.reducer.repository import ReducerRepository
from polar.reducer_bucket.repository import ReducerBucketRepository
from polar.reducer_bucket.service import REDUCER_BUCKET_SIZE

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
    ReducerBucketOutgoingMessage,
    ReducerBucketOutgoingMessagePayload,
)
from .stream import OutpostEvent, ReducerBucketOutpostEvent

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
            case "reducer_bucket":
                return await self._send_reducer_bucket(
                    session, organization, event, send_stream
                )

    async def _send_configuration(
        self,
        session: AsyncReadSession,
        organization: Organization,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        reducer_repository = ReducerRepository.from_session(session)
        reducers = await reducer_repository.get_all_active_by_organization(
            organization.id, options=(selectinload(Reducer.meter_reducers),)
        )
        message = OutgoingMessageAdapter.validate_python(
            {
                "type": OutgoingMessageType.configuration,
                "payload": {"reducers": reducers},
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
        if isinstance(payload, CustomerMeterIncomingMessageCustomerPayload):
            customer_meter = (
                await customer_meter_repository.get_by_organization_customer_and_meter(
                    organization.id, payload.customer_id, payload.meter_id
                )
            )
        else:
            customer_meter = await customer_meter_repository.get_by_organization_external_customer_and_meter(
                organization.id, payload.external_customer_id, payload.meter_id
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

    async def _send_reducer_bucket(
        self,
        session: AsyncReadSession,
        organization: Organization,
        event: ReducerBucketOutpostEvent,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        bucket_start = datetime.fromisoformat(event["bucket_start"])
        repository = ReducerBucketRepository.from_session(session)
        count, total, minimum, maximum = await repository.get_totals(
            organization.id,
            event["reducer_id"],
            bucket_start,
            bucket_start + REDUCER_BUCKET_SIZE,
            event["customer_id"],
            event["external_customer_id"],
        )
        message = ReducerBucketOutgoingMessage(
            type=OutgoingMessageType.reducer_bucket,
            payload=ReducerBucketOutgoingMessagePayload(
                reducer_id=event["reducer_id"],
                customer_id=event["customer_id"],
                external_customer_id=event["external_customer_id"],
                bucket_start=bucket_start,
                count=count,
                sum=total,
                min=minimum,
                max=maximum,
            ),
        )
        await send_stream.send(message)


outpost = OutpostService()
