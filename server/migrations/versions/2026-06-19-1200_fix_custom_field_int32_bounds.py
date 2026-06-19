"""Fix custom field number properties exceeding INT32 bounds

Revision ID: e3a7c91f4d8b
Revises: 718f3b9ee0f5
Create Date: 2026-06-19 12:00:00.000000

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "e3a7c91f4d8b"
down_revision = "718f3b9ee0f5"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    # Repair number-type custom fields whose `ge`/`le` bounds were persisted
    # outside the INT32 range, which break Pydantic validation on reads.
    op.execute(
        """
        UPDATE custom_fields
        SET properties = properties - 'ge'
        WHERE type = 'number'
          AND jsonb_typeof(properties->'ge') = 'number'
          AND (
              (properties->>'ge')::numeric < -2147483648
              OR (properties->>'ge')::numeric > 2147483647
          )
        """
    )
    op.execute(
        """
        UPDATE custom_fields
        SET properties = properties - 'le'
        WHERE type = 'number'
          AND jsonb_typeof(properties->'le') = 'number'
          AND (
              (properties->>'le')::numeric < -2147483648
              OR (properties->>'le')::numeric > 2147483647
          )
        """
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    pass
