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
from polar.exceptions import BadRequest, ResourceNotFound
from polar.kit.db.postgres import AsyncReadSession
from polar.logging import Logger
from polar.meter.aggregation import UniqueAggregation
from polar.models import Customer, Organization, Reducer
from polar.models.reducer import ReducerKind
from polar.redis import Redis
from polar.reducer.bucket_repository import get_customer_identities
from polar.reducer.repository import ReducerRepository
from polar.reducer.service import get_reducer_bucket_start
from polar.reducer.service import reducer as reducer_service

from . import stream
from .schemas import (
    Changes,
    ConfigurationOutgoingMessage,
    ConfigurationOutgoingMessagePayload,
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
    OutgoingMessageType,
)
from .stream import MAX_SEQUENCE, Cursor, OutpostEvent, ReducerBucketOutpostEvent

log: Logger = structlog.get_logger(__name__)

type Identity = tuple[uuid.UUID | None, str | None]

# Buckets that started earlier than this have been synced.
SYNCED_LOOKBACK = timedelta(hours=1)

# A cursor older than this may have missed trimmed changes. Half the retention leaves
# room for the clocks of the API and Redis to disagree.
CURSOR_MAX_AGE = stream.CHANGES_RETENTION / 2


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
                await send_stream.send(
                    ConfigurationOutgoingMessage(
                        type=OutgoingMessageType.configuration,
                        payload=await self.get_configuration(session, organization),
                    )
                )
            case IncomingMessageType.meter_usage:
                try:
                    snapshots = await self.get_requested_meter_usage(
                        session, organization, incoming.payload
                    )
                except ResourceNotFound:
                    log.warning(
                        "Reducer not found",
                        organization_id=organization.id,
                        reducer_id=incoming.payload.reducer_id,
                    )
                    return
                for snapshot in snapshots:
                    await send_stream.send(
                        MeterUsageOutgoingMessage(
                            type=OutgoingMessageType.meter_usage, payload=snapshot
                        )
                    )
            case IncomingMessageType.confirm:
                try:
                    confirmed = await self.confirm(
                        session, organization, incoming.payload
                    )
                except ResourceNotFound:
                    log.warning(
                        "Reducer not found",
                        organization_id=organization.id,
                        reducer_id=incoming.payload.reducer_id,
                    )
                    return
                await send_stream.send(
                    ConfirmedOutgoingMessage(
                        type=OutgoingMessageType.confirmed, payload=confirmed
                    )
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

    async def get_changes(
        self,
        session: AsyncReadSession,
        redis: Redis,
        organization: Organization,
        after: Cursor | None,
        limit: int,
    ) -> Changes:
        """The snapshots of the identities that changed after the cursor, computed
        once each from the current database."""
        # One more than the limit tells whether more follow.
        entries, now = await stream.read_changes(
            redis, organization.id, after, limit + 1
        )
        has_more = len(entries) > limit
        entries = entries[:limit]
        # Later entries get an id from this millisecond on.
        seen = Cursor(now - 1, MAX_SEQUENCE)
        next_poll_in = int(settings.OUTPOST_PULL_INTERVAL.total_seconds())
        reset = (
            after is not None
            and after.milliseconds < now - CURSOR_MAX_AGE / timedelta(milliseconds=1)
        )
        if after is None or reset:
            return Changes(
                changes=[],
                cursor=str(seen),
                has_more=False,
                reset=reset,
                configuration_changed=False,
                next_poll_in=next_poll_in,
            )

        with logfire.span(
            "outpost.changes",
            organization_id=str(organization.id),
            entries=len(entries),
        ) as span:
            events: dict[tuple[uuid.UUID, Identity], ReducerBucketOutpostEvent] = {}
            configuration_changed = False
            for _, event in entries:
                match event["type"]:
                    case "reducer_bucket":
                        identity = (event["customer_id"], event["external_customer_id"])
                        events[(event["reducer_id"], identity)] = event
                    case "configuration":
                        configuration_changed = True
            changes = [
                payload
                for event in events.values()
                for payload in await self._get_reducer_bucket_usage(
                    session, organization, event
                )
            ]
            span.set_attribute("changes", len(changes))

        last = entries[-1][0] if entries else after
        return Changes(
            changes=changes,
            cursor=str(last if has_more else max(last, seen)),
            has_more=has_more,
            reset=False,
            configuration_changed=configuration_changed,
            next_poll_in=next_poll_in,
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

    async def get_configuration(
        self, session: AsyncReadSession, organization: Organization
    ) -> ConfigurationOutgoingMessagePayload:
        reducer_repository = ReducerRepository.from_session(session)
        reducers = await reducer_repository.get_all_active_by_organization_and_kinds(
            organization.id,
            tuple(ReducerKind),
            options=(selectinload(Reducer.meter_reducers),),
        )
        return ConfigurationOutgoingMessagePayload.model_validate(
            {
                "reducers": [
                    reducer
                    for reducer in reducers
                    if not isinstance(reducer.aggregation, UniqueAggregation)
                ]
            }
        )

    async def get_requested_meter_usage(
        self,
        session: AsyncReadSession,
        organization: Organization,
        payload: MeterUsageIncomingMessagePayload,
    ) -> list[MeterUsageOutgoingMessagePayload]:
        """The snapshots of every identity of the customer."""
        reducer = await ReducerRepository.from_session(
            session
        ).get_active_by_id_and_kinds(payload.reducer_id, tuple(ReducerKind))
        if reducer is None or reducer.organization_id != organization.id:
            raise ResourceNotFound()
        if isinstance(payload, MeterUsageIncomingMessageCustomerPayload):
            identity: Identity = (payload.customer_id, None)
        else:
            identity = (None, payload.external_customer_id)
        customer = await self._get_customer(session, organization, identity)
        return await self._get_meter_usage(
            session,
            reducer,
            get_customer_identities(customer) if customer else [identity],
            customer,
        )

    async def confirm(
        self,
        session: AsyncReadSession,
        organization: Organization,
        payload: ConfirmIncomingMessagePayload,
    ) -> ConfirmedOutgoingMessagePayload:
        """The requested ids stored so far, with the meter's snapshot read from the same
        database snapshot: it counts exactly those."""
        with logfire.span(
            "outpost.confirm",
            organization_id=str(organization.id),
            requested=len(payload.ids),
        ) as span:
            # The ids and the totals must come from one database snapshot, or an
            # ingestion between the two reads makes them disagree.
            # REPEATABLE READ serves the same snapshot for all queries in the session.
            if isinstance(session.bind, AsyncEngine):
                await session.connection(
                    execution_options={"isolation_level": "REPEATABLE READ"}
                )
            reducer = await ReducerRepository.from_session(
                session
            ).get_active_by_id_and_kinds(payload.reducer_id, (ReducerKind.usage,))
            if reducer is None or reducer.organization_id != organization.id:
                raise ResourceNotFound()
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
                raise ResourceNotFound()
            return ConfirmedOutgoingMessagePayload(
                reducer_id=payload.reducer_id,
                customer_id=identity[0],
                external_customer_id=identity[1],
                bucket_start=payload.bucket_start,
                ids=[
                    external_id for external_id in payload.ids if external_id in stored
                ],
                snapshot=snapshots[0],
            )

    async def _send_reducer_bucket(
        self,
        session: AsyncReadSession,
        organization: Organization,
        event: ReducerBucketOutpostEvent,
        send_stream: MemoryObjectSendStream[OutgoingMessage],
    ) -> None:
        for payload in await self._get_reducer_bucket_usage(
            session, organization, event
        ):
            await send_stream.send(
                MeterUsageOutgoingMessage(
                    type=OutgoingMessageType.meter_usage, payload=payload
                )
            )

    async def _get_reducer_bucket_usage(
        self,
        session: AsyncReadSession,
        organization: Organization,
        event: ReducerBucketOutpostEvent,
    ) -> list[MeterUsageOutgoingMessagePayload]:
        reducer = await ReducerRepository.from_session(
            session
        ).get_active_by_id_and_kinds(event["reducer_id"], tuple(ReducerKind))
        if reducer is None:
            return []
        identity = (event["customer_id"], event["external_customer_id"])
        customer = await self._get_customer(session, organization, identity)
        return await self._get_meter_usage(
            session,
            reducer,
            # Credits are the customer's, whatever identity it reads them with.
            get_customer_identities(customer)
            if reducer.kind == ReducerKind.credit and customer is not None
            else [identity],
            customer,
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
