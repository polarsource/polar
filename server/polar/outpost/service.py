import uuid
from collections.abc import Mapping, Sequence
from datetime import timedelta

import logfire
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
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.orm import selectinload

from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.exceptions import BadRequest, ResourceNotFound
from polar.kit.db.postgres import AsyncReadSession
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
    Configuration,
    Confirmation,
    ConfirmRequest,
    CustomerConfirmRequest,
    CustomerMeterUsageIdentity,
    MeterUsageIdentity,
    Snapshot,
)
from .stream import MAX_SEQUENCE, Cursor, ReducerBucketOutpostEvent

type Identity = tuple[uuid.UUID | None, str | None]

# Buckets that started earlier than this have been synced.
SYNCED_LOOKBACK = timedelta(hours=1)

# A cursor older than this may have missed trimmed changes. Half the retention leaves
# room for the clocks of the API and Redis to disagree.
CURSOR_MAX_AGE = stream.CHANGES_RETENTION / 2


def _get_identity(payload: MeterUsageIdentity | ConfirmRequest) -> Identity:
    if isinstance(payload, CustomerMeterUsageIdentity | CustomerConfirmRequest):
        return (payload.customer_id, None)
    return (None, payload.external_customer_id)


class OutpostService:
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
        oldest = now - CURSOR_MAX_AGE / timedelta(milliseconds=1)
        # The changes behind the new cursor are not served, a configuration change
        # included: the client starts over from the current configuration.
        if after is None or not oldest <= after.milliseconds <= now:
            return Changes(
                changes=[],
                cursor=str(seen),
                has_more=False,
                reset=True,
                configuration_changed=True,
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
            changes = await self._get_reducer_bucket_usage(
                session, organization, list(events.values())
            )
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
    ) -> Configuration:
        reducer_repository = ReducerRepository.from_session(session)
        reducers = await reducer_repository.get_all_active_by_organization_and_kinds(
            organization.id,
            tuple(ReducerKind),
            options=(selectinload(Reducer.meter_reducers),),
        )
        return Configuration.model_validate(
            {
                "organization_id": organization.id,
                "reducers": [
                    reducer
                    for reducer in reducers
                    if not isinstance(reducer.aggregation, UniqueAggregation)
                ],
            }
        )

    async def get_requested_meter_usage(
        self,
        session: AsyncReadSession,
        organization: Organization,
        payloads: Sequence[MeterUsageIdentity],
    ) -> list[Snapshot]:
        """The snapshots of every identity of the requested customers, reading the
        customers once for all reducers."""
        with logfire.span(
            "outpost.meter_usage",
            organization_id=str(organization.id),
            requested=len(payloads),
        ) as span:
            reducers = await self._get_reducers(session, organization)
            requested: dict[uuid.UUID, list[Identity]] = {}
            for payload in payloads:
                if payload.reducer_id not in reducers:
                    continue
                requested.setdefault(payload.reducer_id, []).append(
                    _get_identity(payload)
                )
            customers = await self._get_customers(
                session,
                organization,
                [
                    identity
                    for identities in requested.values()
                    for identity in identities
                ],
            )
            snapshots = await self._get_meter_usage(
                session,
                {
                    reducers[reducer_id]: {
                        known: customer
                        for identity in identities
                        for customer in (customers[identity],)
                        for known in (
                            get_customer_identities(customer)
                            if customer
                            else [identity]
                        )
                    }
                    for reducer_id, identities in requested.items()
                },
            )
            span.set_attribute("snapshots", len(snapshots))
            return snapshots

    async def confirm(
        self,
        session: AsyncReadSession,
        organization: Organization,
        payload: ConfirmRequest,
    ) -> Confirmation:
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
            identity = _get_identity(payload)
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
                {reducer: await self._get_customers(session, organization, [identity])},
            )
            if not snapshots:
                raise ResourceNotFound()
            return Confirmation(
                reducer_id=payload.reducer_id,
                customer_id=identity[0],
                external_customer_id=identity[1],
                bucket_start=payload.bucket_start,
                ids=[
                    external_id for external_id in payload.ids if external_id in stored
                ],
                snapshot=snapshots[0],
            )

    async def _get_reducers(
        self, session: AsyncReadSession, organization: Organization
    ) -> dict[uuid.UUID, Reducer]:
        return {
            reducer.id: reducer
            for reducer in await ReducerRepository.from_session(
                session
            ).get_all_active_by_organization_and_kinds(
                organization.id, tuple(ReducerKind)
            )
        }

    async def _get_reducer_bucket_usage(
        self,
        session: AsyncReadSession,
        organization: Organization,
        events: Sequence[ReducerBucketOutpostEvent],
    ) -> list[Snapshot]:
        if not events:
            return []
        reducers = await self._get_reducers(session, organization)
        customers = await self._get_customers(
            session,
            organization,
            [(event["customer_id"], event["external_customer_id"]) for event in events],
        )
        identities: dict[uuid.UUID, dict[Identity, Customer | None]] = {}
        for event in events:
            reducer = reducers.get(event["reducer_id"])
            if reducer is None:
                continue
            identity = (event["customer_id"], event["external_customer_id"])
            customer = customers[identity]
            identities.setdefault(reducer.id, {}).update(
                dict.fromkeys(
                    # Credits are the customer's, whatever identity it reads them with.
                    get_customer_identities(customer)
                    if reducer.kind == ReducerKind.credit and customer is not None
                    else [identity],
                    customer,
                )
            )
        return await self._get_meter_usage(
            session,
            {
                reducers[reducer_id]: reducer_identities
                for reducer_id, reducer_identities in identities.items()
            },
        )

    async def _get_customers(
        self,
        session: AsyncReadSession,
        organization: Organization,
        identities: Sequence[Identity],
    ) -> dict[Identity, Customer | None]:
        customers = await CustomerRepository.from_session(
            session
        ).get_all_by_organization_and_ids_or_external_ids(
            organization.id,
            {customer_id for customer_id, _ in identities if customer_id is not None},
            {
                external_customer_id
                for customer_id, external_customer_id in identities
                if customer_id is None and external_customer_id is not None
            },
        )
        by_id = {customer.id: customer for customer in customers}
        by_external_id: dict[str | None, Customer] = {
            customer.external_id: customer for customer in customers
        }
        return {
            (customer_id, external_customer_id): by_id.get(customer_id)
            if customer_id is not None
            else by_external_id.get(external_customer_id)
            for customer_id, external_customer_id in identities
        }

    async def _get_meter_usage(
        self,
        session: AsyncReadSession,
        requested: Mapping[Reducer, Mapping[Identity, Customer | None]],
    ) -> list[Snapshot]:
        """Each reducer's snapshots of its customers, every reducer read at once."""
        requested = {
            reducer: customers
            for reducer, customers in requested.items()
            if not isinstance(reducer.aggregation, UniqueAggregation)
        }
        if not requested:
            return []

        version = await reducer_service.get_database_now(session)
        since = get_reducer_bucket_start(version - SYNCED_LOOKBACK)
        organization_id = next(iter(requested)).organization_id
        # Credits are the customer's and all in Polar: Outpost never counts any.
        credits = await reducer_service.get_credits(
            session,
            organization_id,
            [
                (reducer.id, customer.id)
                for reducer, customers in requested.items()
                if reducer.kind == ReducerKind.credit
                for customer in customers.values()
                if customer is not None
            ],
        )
        usage_customers = {
            (reducer.id, identity): customer
            for reducer, customers in requested.items()
            if reducer.kind != ReducerKind.credit
            for identity, customer in customers.items()
        }
        cold_usage = await reducer_service.get_cold_usage(
            session,
            organization_id,
            list(usage_customers),
            since=since,
            customers={
                identity: customer.id
                for identity, customer in usage_customers.items()
                if customer is not None
            },
        )
        payloads = []
        for reducer, customers in requested.items():
            for identity, customer in customers.items():
                if reducer.kind == ReducerKind.credit:
                    cold_until, (count, total, minimum, maximum) = (
                        version,
                        credits[(reducer.id, customer.id)]
                        if customer is not None
                        else (0, 0, None, None),
                    )
                else:
                    cold_until, (count, total, minimum, maximum) = cold_usage[
                        (reducer.id, identity)
                    ]
                customer_id, external_customer_id = identity
                payloads.append(
                    Snapshot(
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
