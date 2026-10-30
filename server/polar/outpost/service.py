import uuid
from collections.abc import Sequence
from datetime import timedelta

import logfire
import structlog
from anyio.streams.memory import MemoryObjectSendStream
from google.protobuf.message import DecodeError
from logfire._internal.forwarding import ForwardExportRequestResponse
from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import (
    ExportMetricsServiceRequest,
)
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, KeyValue
from opentelemetry.proto.resource.v1.resource_pb2 import Resource
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.orm import selectinload

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.exceptions import BadRequest
from polar.kit.db.postgres import AsyncReadSession
from polar.logging import Logger
from polar.meter.aggregation import UniqueAggregation
from polar.models import Customer, Organization, Reducer
from polar.models.reducer import ReducerKind
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import (
    get_customer_identities,
    get_reducer_bucket_start,
)
from polar.reducer.service import reducer as reducer_service

from .schemas import (
    ConfirmedOutgoingMessage,
    ConfirmedOutgoingMessagePayload,
    ConfirmIncomingMessageCustomerPayload,
    ConfirmIncomingMessagePayload,
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
            case IncomingMessageType.confirm:
                return await self._send_confirmed(
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

    def relay_telemetry(
        self, organization: Organization, body: bytes
    ) -> ForwardExportRequestResponse:
        request = ExportTraceServiceRequest()
        try:
            request.ParseFromString(body)
        except DecodeError as e:
            raise BadRequest("Invalid OTLP trace export request.") from e
        for resource_spans in request.resource_spans:
            self._override_resource(resource_spans.resource, organization)
        return logfire.forward_export_request(
            path="/v1/traces",
            headers={"Content-Type": "application/x-protobuf"},
            body=request.SerializeToString(),
        )

    def relay_metrics(
        self, organization: Organization, body: bytes
    ) -> ForwardExportRequestResponse:
        request = ExportMetricsServiceRequest()
        try:
            request.ParseFromString(body)
        except DecodeError as e:
            raise BadRequest("Invalid OTLP metrics export request.") from e
        for resource_metrics in request.resource_metrics:
            self._override_resource(resource_metrics.resource, organization)
        return logfire.forward_export_request(
            path="/v1/metrics",
            headers={"Content-Type": "application/x-protobuf"},
            body=request.SerializeToString(),
        )

    def _override_resource(
        self, resource: Resource, organization: Organization
    ) -> None:
        overrides = {
            "polar.organization_id": str(organization.id),
            "service.name": "outpost",
            "deployment.environment.name": settings.ENV,
        }
        attributes = resource.attributes
        kept = [attribute for attribute in attributes if attribute.key not in overrides]
        del attributes[:]
        attributes.extend(kept)
        attributes.extend(
            KeyValue(key=key, value=AnyValue(string_value=value))
            for key, value in overrides.items()
        )

    async def _send_configuration(
        self,
        session: AsyncReadSession,
        organization: Organization,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        reducer_repository = ReducerRepository.from_session(session)
        reducers = await reducer_repository.get_all_active_by_organization_and_kinds(
            organization.id,
            tuple(ReducerKind),
            options=(selectinload(Reducer.meter_reducers),),
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
        reducer = await ReducerRepository.from_session(
            session
        ).get_active_by_id_and_kinds(payload.reducer_id, tuple(ReducerKind))
        if reducer is None or reducer.organization_id != organization.id:
            log.warning(
                "Reducer not found",
                organization_id=organization.id,
                reducer_id=payload.reducer_id,
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
            get_customer_identities(customer) if customer else [identity],
            customer,
            send_stream,
        )

    async def _send_confirmed(
        self,
        session: AsyncReadSession,
        organization: Organization,
        payload: ConfirmIncomingMessagePayload,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        """The requested ids stored so far, with the meter's snapshot read from the same
        database snapshot: it counts exactly those."""
        with logfire.span(
            "outpost.confirm",
            organization_id=str(organization.id),
            requested=len(payload.ids),
        ) as span:
            if isinstance(session.bind, AsyncEngine):
                await session.connection(
                    execution_options={"isolation_level": "REPEATABLE READ"}
                )
            reducer = await ReducerRepository.from_session(
                session
            ).get_active_by_id_and_kinds(payload.reducer_id, (ReducerKind.usage,))
            if reducer is None or reducer.organization_id != organization.id:
                log.warning(
                    "Reducer not found",
                    organization_id=organization.id,
                    reducer_id=payload.reducer_id,
                )
                return
            if isinstance(payload, ConfirmIncomingMessageCustomerPayload):
                identity: Identity = (payload.customer_id, None)
            else:
                identity = (None, payload.external_customer_id)
            stored = await reducer_service.get_stored_external_ids(
                session,
                reducer,
                *identity,
                bucket_start=payload.bucket_start,
                external_ids=payload.ids,
            )
            span.set_attribute("stored", len(stored))
            snapshots = await self._get_meter_usage(
                session,
                reducer,
                [identity],
                await self._get_customer(session, organization, identity),
            )
            if not snapshots:
                return
            await send_stream.send(
                ConfirmedOutgoingMessage(
                    type=OutgoingMessageType.confirmed,
                    payload=ConfirmedOutgoingMessagePayload(
                        reducer_id=payload.reducer_id,
                        customer_id=identity[0],
                        external_customer_id=identity[1],
                        bucket_start=payload.bucket_start,
                        ids=[
                            external_id
                            for external_id in payload.ids
                            if external_id in stored
                        ],
                        snapshot=snapshots[0],
                    ),
                )
            )

    async def _send_reducer_bucket(
        self,
        session: AsyncReadSession,
        organization: Organization,
        event: ReducerBucketOutpostEvent,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        reducer = await ReducerRepository.from_session(
            session
        ).get_active_by_id_and_kinds(event["reducer_id"], tuple(ReducerKind))
        if reducer is None:
            return
        identity = (event["customer_id"], event["external_customer_id"])
        customer = await self._get_customer(session, organization, identity)
        await self._send_meter_usage(
            session,
            organization,
            reducer,
            # Credits are the customer's, whatever identity it reads them with.
            get_customer_identities(customer)
            if reducer.kind == ReducerKind.credit and customer is not None
            else [identity],
            customer,
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
        identities: Sequence[Identity],
        customer: Customer | None,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        for payload in await self._get_meter_usage(
            session, reducer, identities, customer
        ):
            await send_stream.send(
                MeterUsageOutgoingMessage(
                    type=OutgoingMessageType.meter_usage, payload=payload
                )
            )

    async def _get_meter_usage(
        self,
        session: AsyncReadSession,
        reducer: Reducer,
        identities: Sequence[Identity],
        customer: Customer | None,
    ) -> list[MeterUsageOutgoingMessagePayload]:
        if isinstance(reducer.aggregation, UniqueAggregation):
            return []

        version = await reducer_service.get_database_now(session)
        since = get_reducer_bucket_start(version - SYNCED_LOOKBACK)
        # Credits are the customer's and all in Polar: Outpost never counts any.
        credits = (
            await reducer_service.get_credits(session, reducer, customer.id)
            if reducer.kind == ReducerKind.credit and customer is not None
            else (0, 0, None, None)
        )
        payloads = []
        for customer_id, external_customer_id in identities:
            if reducer.kind == ReducerKind.credit:
                cold_until, (count, total, minimum, maximum) = version, credits
            else:
                (
                    cold_until,
                    (count, total, minimum, maximum),
                ) = await reducer_service.get_cold_usage(
                    session, reducer, customer_id, external_customer_id, since=since
                )
            payloads.append(
                MeterUsageOutgoingMessagePayload(
                    reducer_id=reducer.id,
                    customer_id=customer_id,
                    external_customer_id=external_customer_id,
                    customer_exists=customer is not None,
                    version=version,
                    cold_until=cold_until,
                    count=count,
                    sum=total,
                    min=minimum,
                    max=maximum,
                )
            )
        return payloads


outpost = OutpostService()
