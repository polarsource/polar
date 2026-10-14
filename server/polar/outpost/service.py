import uuid
from collections.abc import Sequence
from datetime import timedelta

import structlog
from anyio.streams.memory import MemoryObjectSendStream
from pydantic import ValidationError
from sqlalchemy.orm import selectinload

from polar.customer.repository import CustomerRepository
from polar.customer_meter.repository import CustomerMeterRepository
from polar.kit.db.postgres import AsyncReadSession
from polar.logging import Logger
from polar.meter.aggregation import UniqueAggregation
from polar.models import Customer, Organization, Reducer
from polar.reducer.repository import ReducerRepository
from polar.reducer_bucket.repository import ReducerBucketRepository
from polar.reducer_bucket.service import (
    get_customer_identities,
    get_reducer_bucket_start,
)

from .schemas import (
    IncomingMessageAdapter,
    IncomingMessageType,
    MeterUsageIncomingMessageCustomerPayload,
    MeterUsageIncomingMessagePayload,
    MeterUsageOutgoingMessage,
    MeterUsageOutgoingMessagePayload,
    OutgoingMessage,
    OutgoingMessageAdapter,
    OutgoingMessageType,
)
from .stream import OutpostEvent, ReducerBucketOutpostEvent

log: Logger = structlog.get_logger(__name__)

type Identity = tuple[uuid.UUID | None, str | None]

# Buckets that started earlier than this have been synced.
SYNCED_LOOKBACK = timedelta(hours=1)


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
            case IncomingMessageType.meter_usage:
                return await self._send_requested_meter_usage(
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

    async def _send_requested_meter_usage(
        self,
        session: AsyncReadSession,
        organization: Organization,
        payload: MeterUsageIncomingMessagePayload,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        reducer = await ReducerRepository.from_session(session).get_by_meter_id(
            payload.meter_id
        )
        if reducer is None or reducer.organization_id != organization.id:
            log.warning(
                "Meter not found",
                organization_id=organization.id,
                meter_id=payload.meter_id,
            )
            return
        if isinstance(payload, MeterUsageIncomingMessageCustomerPayload):
            identity: Identity = (payload.customer_id, None)
        else:
            identity = (None, payload.external_customer_id)
        customer = await self._get_customer(session, organization, identity)
        await self._send_meter_usage(
            session,
            organization,
            reducer,
            [payload.meter_id],
            get_customer_identities(customer) if customer else [identity],
            customer,
            send_stream,
        )

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
        if reducer is None:
            return
        identity = (event["customer_id"], event["external_customer_id"])
        await self._send_meter_usage(
            session,
            organization,
            reducer,
            reducer.meter_ids,
            [identity],
            await self._get_customer(session, organization, identity),
            send_stream,
        )

    async def _get_customer(
        self, session: AsyncReadSession, organization: Organization, identity: Identity
    ) -> Customer | None:
        customer_id, external_customer_id = identity
        repository = CustomerRepository.from_session(session)
        if customer_id is not None:
            return await repository.get_by_id_and_organization(
                customer_id, organization.id
            )
        assert external_customer_id is not None
        return await repository.get_by_external_id_and_organization(
            external_customer_id, organization.id
        )

    async def _send_meter_usage(
        self,
        session: AsyncReadSession,
        organization: Organization,
        reducer: Reducer,
        meter_ids: Sequence[uuid.UUID],
        identities: Sequence[Identity],
        customer: Customer | None,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        if isinstance(reducer.aggregation, UniqueAggregation):
            return

        repository = ReducerBucketRepository.from_session(session)
        version = await repository.get_database_now()
        since = get_reducer_bucket_start(version - SYNCED_LOOKBACK)
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
        for customer_id, external_customer_id in identities:
            cold_until = (
                await repository.get_last_synced_end(
                    organization.id,
                    reducer.id,
                    customer_id,
                    external_customer_id,
                    since=since,
                )
                or since
            )
            count, total, minimum, maximum = await repository.get_unsealed_totals(
                organization.id,
                reducer.id,
                [(customer_id, external_customer_id)],
                before=cold_until,
            )
            for meter_id in meter_ids:
                await send_stream.send(
                    MeterUsageOutgoingMessage(
                        type=OutgoingMessageType.meter_usage,
                        payload=MeterUsageOutgoingMessagePayload(
                            meter_id=meter_id,
                            customer_id=customer_id,
                            external_customer_id=external_customer_id,
                            version=version,
                            cold_until=cold_until,
                            count=count,
                            sum=total,
                            min=minimum,
                            max=maximum,
                            credited_units=credited_units.get(meter_id, 0),
                        ),
                    )
                )


outpost = OutpostService()
