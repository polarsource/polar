"""add mcp subscription fields to webhook endpoints

Revision ID: f09f2f11e21c
Revises: 3f9c1a7e2b4d
Create Date: 2026-11-05 11:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f09f2f11e21c"
down_revision = "3f9c1a7e2b4d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.add_column(
        "webhook_endpoints",
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.add_column("webhook_endpoints", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("webhook_endpoints_user_id_fkey"),
        "webhook_endpoints",
        "users",
        ["user_id"],
        ["id"],
        ondelete="cascade",
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        op.f("webhook_endpoints_user_id_fkey"), "webhook_endpoints", type_="foreignkey"
    )
    op.drop_column("webhook_endpoints", "user_id")
    op.drop_column("webhook_endpoints", "expires_at")
