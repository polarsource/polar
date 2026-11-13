"""enforce custom_fields.is_current NOT NULL

Revision ID: 84205fdb9945
Revises: 4b930dd42c3c
Create Date: 2026-11-12 14:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "84205fdb9945"
down_revision = "4b930dd42c3c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


NOT_NULL_CHECK = "custom_fields_is_current_not_null_check"


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            # b38e1fd8a5a5 added is_current with DEFAULT true (populating existing
            # rows via pg_attribute.attmissingval without a table rewrite) and
            # CustomField.is_current sets default=True on ORM inserts, so this
            # safety-net UPDATE matches no rows.
            op.execute(
                "UPDATE custom_fields SET is_current = true WHERE is_current IS NULL"
            )

            validated: bool | None = None
            if not op.get_context().as_sql:
                validated = op.get_bind().scalar(
                    sa.text(
                        "SELECT convalidated FROM pg_constraint "
                        "WHERE conname = :name "
                        "AND conrelid = 'custom_fields'::regclass"
                    ),
                    {"name": NOT_NULL_CHECK},
                )

            if validated is None:
                op.execute(
                    f"ALTER TABLE custom_fields ADD CONSTRAINT {NOT_NULL_CHECK} "
                    "CHECK (is_current IS NOT NULL) NOT VALID"
                )
            if not validated:
                op.execute(
                    f"ALTER TABLE custom_fields VALIDATE CONSTRAINT {NOT_NULL_CHECK}"
                )

            op.alter_column(
                "custom_fields",
                "is_current",
                existing_type=sa.Boolean(),
                nullable=False,
            )
            op.execute(f"ALTER TABLE custom_fields DROP CONSTRAINT {NOT_NULL_CHECK}")
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.alter_column(
                "custom_fields",
                "is_current",
                existing_type=sa.Boolean(),
                nullable=True,
            )
        finally:
            op.execute("RESET lock_timeout")
