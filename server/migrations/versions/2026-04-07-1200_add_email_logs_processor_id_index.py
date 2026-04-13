"""add email_logs processor_id index

Revision ID: 47679778d594
Revises: 6faf4c067fee
Create Date: 2026-04-07 12:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "47679778d594"
down_revision = "6faf4c067fee"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.create_index(
            op.f("ix_email_logs_processor_id"),
            "email_logs",
            ["processor_id"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_email_logs_processor_id"),
        table_name="email_logs",
    )
