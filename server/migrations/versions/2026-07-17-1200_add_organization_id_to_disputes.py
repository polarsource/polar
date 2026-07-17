"""add organization_id to disputes

Revision ID: b7e3f2a19c4d
Revises: 638a2f04c7ce
Create Date: 2026-07-17 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b7e3f2a19c4d"
down_revision = "638a2f04c7ce"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.add_column(
        "disputes",
        sa.Column("organization_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        op.f("disputes_organization_id_fkey"),
        "disputes",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="restrict",
    )
    with op.get_context().autocommit_block():
        op.create_index(
            op.f("ix_disputes_organization_id"),
            "disputes",
            ["organization_id"],
            unique=False,
            postgresql_concurrently=True,
        )


def downgrade() -> None:
    op.drop_constraint(
        op.f("disputes_organization_id_fkey"), "disputes", type_="foreignkey"
    )
    op.drop_index(op.f("ix_disputes_organization_id"), table_name="disputes")
    op.drop_column("disputes", "organization_id")
