import structlog
from anyio.streams.memory import MemoryObjectSendStream
from pydantic import ValidationError
from sqlalchemy.orm import selectinload

from polar.customer.repository import CustomerRepository
from polar.customer_meter.repository import CustomerMeterRepository
from polar.kit.db.postgres import AsyncReadSession
from polar.logging import Logger
from polar.meter.aggregation import UniqueAggregation
from polar.models import Organization, Reducer
from polar.reducer.repository import ReducerRepository
from polar.reducer_bucket.repository import ReducerBucketRepository
from polar.reducer_bucket.service import get_customer_identities

from .schemas import (
    CustomerMeterIncomingMessageCustomerPayload,
    CustomerMeterIncomingMessagePayload,
    CustomerMeterOutgoingMessage,
    CustomerMeterOutgoingMessagePayload,
    IncomingMessageAdapter,
    IncomingMessageType,
    MeterBalanceOutgoingMessage,
    MeterBalanceOutgoingMessagePayload,
    OutgoingMessage,
    OutgoingMessageAdapter,
    OutgoingMessageType,
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
        reducer = await ReducerRepository.from_session(session).get_active_by_id(
            event["reducer_id"], options=(selectinload(Reducer.meter_reducers),)
        )
        if reducer is None or isinstance(reducer.aggregation, UniqueAggregation):
            return

        customer_id = event["customer_id"]
        external_customer_id = event["external_customer_id"]
        customer_repository = CustomerRepository.from_session(session)
        if customer_id is not None:
            customer = await customer_repository.get_by_id_and_organization(
                customer_id, organization.id
            )
        else:
            assert external_customer_id is not None
            customer = await customer_repository.get_by_external_id_and_organization(
                external_customer_id, organization.id
            )
        if customer is not None:
            customer_id = customer.id
            external_customer_id = customer.external_id
            identities = get_customer_identities(customer)
        else:
            identities = [(customer_id, external_customer_id)]

        count, total, minimum, maximum = await ReducerBucketRepository.from_session(
            session
        ).get_unsealed_totals(organization.id, reducer.id, identities)
        # Temporary: credits come from customer meters until credits are reducers.
        # Credits reset on renewal before the billed usage gets sealed, so balances
        # are too low in between.
        customer_meters = (
            await CustomerMeterRepository.from_session(
                session
            ).get_all_by_customer_and_reducer(customer.id, reducer.id)
            if customer is not None
            else []
        )
        credited_units = {
            customer_meter.meter_id: customer_meter.credited_units
            for customer_meter in customer_meters
        }
        for meter_id in reducer.meter_ids:
            await send_stream.send(
                MeterBalanceOutgoingMessage(
                    type=OutgoingMessageType.meter_balance,
                    payload=MeterBalanceOutgoingMessagePayload(
                        meter_id=meter_id,
                        customer_id=customer_id,
                        external_customer_id=external_customer_id,
                        count=count,
                        sum=total,
                        min=minimum,
                        max=maximum,
                        credited_units=credited_units.get(meter_id, 0),
                    ),
                )
            )


outpost = OutpostService()
