"""
SQLAlchemy model for the events_metrics_hourly continuous aggregate.

This is a read-only materialized view that pre-computes event metrics
at hourly granularity. With real-time aggregation enabled, queries
automatically include fresh data from the raw hypertable for the
most recent un-materialized period.
"""

import datetime
from collections.abc import Generator
from decimal import Decimal
from uuid import UUID

from alembic_utils.replaceable_entity import ReplaceableEntity, register_entities
from sqlalchemy import TIMESTAMP, Index, Numeric, String, Uuid, text
from sqlalchemy.orm import Mapped, Session, mapped_column
from sqlalchemy.sql.elements import TextClause

from polar.kit.db.models import Model


# https://github.com/candidhealth/alembic-utils-extended/blob/9b48280a221e9861aa2f4d0751b8f73ddc5ca005/src/alembic_utils_extended/pg_materialized_view.py
# TimescaleDBContinuousAggregate is licensed under the MIT License
#
# Copyright (c) 2020 Candid Health
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
class TimescaleDBContinuousAggregate(ReplaceableEntity):
    """
    A TimescaleDB Continuous Aggregate compatible with `alembic revision --autogenerate`.

    Based on PGMaterializedView pattern but uses TimescaleDB-specific syntax and
    queries timescaledb_information.continuous_aggregates for database state.
    """

    type_ = "timescaledb_continuous_aggregate"

    def __init__(
        self,
        schema: str,
        signature: str,
        definition: str,
        with_data: bool = False,
        materialized_only: bool = False,
        indexes: list[str] | None = None,
    ):
        super().__init__(schema, signature, definition)
        self.with_data = with_data
        self.materialized_only = materialized_only
        self.indexes = indexes or []

    def to_sql_statement_create(self) -> TextClause:
        mat_only = "true" if self.materialized_only else "false"
        with_data = "" if self.with_data else "NO "
        return text(f"""
            CREATE MATERIALIZED VIEW IF NOT EXISTS {self.literal_schema}."{self.signature}"
            WITH (timescaledb.continuous, timescaledb.materialized_only = {mat_only}) AS
            {self.definition}
            WITH {with_data}DATA
        """)

    def to_sql_statement_create_indexes(self) -> Generator[TextClause, None, None]:
        for index_sql in self.indexes:
            yield text(index_sql)

    def to_sql_statement_drop(self, cascade: bool = False) -> TextClause:
        cascade_sql = "CASCADE" if cascade else ""
        return text(
            f'DROP MATERIALIZED VIEW IF EXISTS {self.literal_schema}."{self.signature}" {cascade_sql}'
        )

    def to_sql_statement_create_or_replace(self) -> Generator[TextClause, None, None]:
        yield self.to_sql_statement_drop(cascade=True)
        yield self.to_sql_statement_create()
        yield from self.to_sql_statement_create_indexes()

    @classmethod
    def from_database(  # type: ignore[override]
        cls, sess: Session, schema: str = "%"
    ) -> list["TimescaleDBContinuousAggregate"]:
        sql = text("""
            SELECT
                ca.view_schema,
                ca.view_name,
                ca.view_definition,
                ca.materialized_only
            FROM timescaledb_information.continuous_aggregates ca
            WHERE ca.view_schema NOT IN ('pg_catalog', 'information_schema')
              AND ca.view_schema::text LIKE :schema
        """)
        rows = sess.execute(sql, {"schema": schema}).fetchall()
        return [
            cls(
                schema=row[0],
                signature=row[1],
                definition=row[2] or "",
                materialized_only=row[3],
            )
            for row in rows
        ]


class EventMetricsHourly(Model):
    """
    Hourly pre-aggregated event metrics.

    Groups by: organization_id, event_name, customer_id, external_customer_id
    Pre-computes: cost sums, event counts

    Used for:
    - Dashboard cost metrics (costs, cumulative_costs, cost_per_user)
    - Event hierarchy stats (per event type cost breakdown)
    - Customer-filtered metrics
    """

    __tablename__ = "events_metrics_hourly"
    __table_args__ = (
        Index(
            "ix_events_metrics_hourly_org_bucket",
            "organization_id",
            "bucket",
        ),
        {"info": {"is_view": True}},
    )

    bucket: Mapped[datetime.datetime] = mapped_column(
        TIMESTAMP(timezone=True), primary_key=True
    )
    organization_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    event_name: Mapped[str] = mapped_column(String(128), primary_key=True)
    customer_id: Mapped[UUID | None] = mapped_column(Uuid, primary_key=True)
    external_customer_id: Mapped[str | None] = mapped_column(String, primary_key=True)

    total_cost: Mapped[Decimal] = mapped_column(Numeric(17, 12), nullable=False)
    event_count: Mapped[int] = mapped_column(nullable=False)
    events_with_cost_count: Mapped[int] = mapped_column(nullable=False)


events_metrics_hourly_cagg = TimescaleDBContinuousAggregate(
    schema="public",
    signature="events_metrics_hourly",
    definition="""
    SELECT
        time_bucket('1 hour', timestamp) AS bucket,
        organization_id,
        name AS event_name,
        customer_id,
        external_customer_id,
        SUM(
            CASE
                WHEN user_metadata ? '_cost'
                THEN (user_metadata->'_cost'->>'amount')::numeric(17, 12)
                ELSE 0
            END
        ) AS total_cost,
        COUNT(*) AS event_count,
        COUNT(*) FILTER (WHERE user_metadata ? '_cost') AS events_with_cost_count
    FROM events_hyper
    GROUP BY
        time_bucket('1 hour', timestamp),
        organization_id,
        name,
        customer_id,
        external_customer_id
""",
    indexes=[
        """
        CREATE INDEX IF NOT EXISTS ix_events_metrics_hourly_org_bucket
        ON events_metrics_hourly (organization_id, bucket DESC)
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_events_metrics_hourly_org_customer_bucket
        ON events_metrics_hourly (organization_id, customer_id, bucket DESC)
        WHERE customer_id IS NOT NULL
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_events_metrics_hourly_org_ext_customer_bucket
        ON events_metrics_hourly (organization_id, external_customer_id, bucket DESC)
        WHERE external_customer_id IS NOT NULL
        """,
        """
        CREATE INDEX IF NOT EXISTS ix_events_metrics_hourly_org_name_bucket
        ON events_metrics_hourly (organization_id, event_name, bucket DESC)
        """,
    ],
)

register_entities([events_metrics_hourly_cagg])
