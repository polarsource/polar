"""disable-timescaledb-extension

Revision ID: 6dfc8955157c
Revises: ab473a734057
Create Date: 2026-01-14 11:25:38.404124

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "6dfc8955157c"
down_revision = "ab473a734057"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    assert connection is not None
    result = connection.execute(
        sa.text("SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb'")
    ).fetchone()
    if result:
        op.execute("DROP EXTENSION IF EXISTS timescaledb CASCADE")


def downgrade() -> None:
    connection = op.get_bind()
    assert connection is not None
    result = connection.execute(
        sa.text("SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb'")
    ).fetchone()

    if result:
        op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE")
