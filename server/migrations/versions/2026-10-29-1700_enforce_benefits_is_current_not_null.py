"""enforce benefits.is_current NOT NULL

Revision ID: 8331ff1c33ff
Revises: 4a2ac2d3f25b
Create Date: 2026-10-29 17:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "8331ff1c33ff"
down_revision = "4a2ac2d3f25b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


NOT_NULL_CHECK = "benefits_is_current_not_null_check"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            # c5f8ae82994c added is_current with DEFAULT true (populating existing rows
            # via pg_attribute.attmissingval without a table rewrite) and Benefit.is_current
            # sets default=True on ORM inserts, so this safety-net UPDATE matches no rows.
            op.execute("UPDATE benefits SET is_current = true WHERE is_current IS NULL")

            validated: bool | None = None
            if not op.get_context().as_sql:
                validated = op.get_bind().scalar(
                    sa.text(
                        "SELECT convalidated FROM pg_constraint "
                        "WHERE conname = :name AND conrelid = 'benefits'::regclass"
                    ),
                    {"name": NOT_NULL_CHECK},
                )

            if validated is None:
                op.execute(
                    f"ALTER TABLE benefits ADD CONSTRAINT {NOT_NULL_CHECK} "
                    "CHECK (is_current IS NOT NULL) NOT VALID"
                )
            if not validated:
                op.execute(f"ALTER TABLE benefits VALIDATE CONSTRAINT {NOT_NULL_CHECK}")

            op.alter_column(
                "benefits",
                "is_current",
                existing_type=sa.Boolean(),
                nullable=False,
            )
            op.execute(f"ALTER TABLE benefits DROP CONSTRAINT {NOT_NULL_CHECK}")
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.alter_column(
                "benefits",
                "is_current",
                existing_type=sa.Boolean(),
                nullable=True,
            )
        finally:
            op.execute("RESET lock_timeout")
