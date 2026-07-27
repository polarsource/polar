"""backfill sso connection authorization parameters

Revision ID: c3553f7b8b0c
Revises: 638a2f04c7ce
Create Date: 2026-07-20 17:38:00.856901

"""

from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "c3553f7b8b0c"
down_revision = "638a2f04c7ce"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        """
        UPDATE organization_sso_connections
        SET configuration = configuration || '{"authorization_parameters": {}}'::jsonb
        WHERE NOT configuration ? 'authorization_parameters'
        """
    )


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.execute(
        """
        UPDATE organization_sso_connections
        SET configuration = configuration - 'authorization_parameters'
        WHERE configuration -> 'authorization_parameters' = '{}'::jsonb
        """
    )
