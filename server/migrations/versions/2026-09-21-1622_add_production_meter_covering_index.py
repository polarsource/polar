"""add production meter covering index

Revision ID: 508561324a89
Revises: 6b92cf7d539b
Create Date: 2026-09-21 16:22:22.566766

"""

import sqlalchemy as sa
from alembic import op

from polar.config import settings

# revision identifiers, used by Alembic.
revision = "508561324a89"
down_revision = "6b92cf7d539b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

INDEX_NAME = "ix_events_meter_a266c3bf-a7a0-4883-950c-b1f995b6193d"


def upgrade() -> None:
    if not settings.is_production():
        return

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            # Recover interrupted builds without rebuilding an existing valid index.
            if not op.get_context().as_sql and op.get_bind().scalar(
                sa.text(
                    "SELECT EXISTS (SELECT 1 FROM pg_index "
                    "WHERE indexrelid = to_regclass(:index_name) AND NOT indisvalid)"
                ),
                {"index_name": f'public."{INDEX_NAME}"'},
            ):
                op.drop_index(
                    INDEX_NAME,
                    table_name="events",
                    if_exists=True,
                    postgresql_concurrently=True,
                )
            op.create_index(
                INDEX_NAME,
                "events",
                ["external_customer_id", "ingested_at"],
                postgresql_include=["user_metadata"],
                postgresql_where=(
                    "organization_id = 'd49ecf1e-4cb2-41f2-827d-ea48b03706f6'::uuid "
                    "AND source = 'user' AND name = 'credit_usage' "
                    "AND external_customer_id IS NOT NULL"
                ),
                postgresql_concurrently=True,
                if_not_exists=True,
            )
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    if not settings.is_production():
        return

    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                INDEX_NAME,
                table_name="events",
                if_exists=True,
                postgresql_concurrently=True,
            )
        finally:
            op.execute("RESET lock_timeout")
