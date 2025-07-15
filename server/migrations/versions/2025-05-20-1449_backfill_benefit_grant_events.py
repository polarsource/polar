"""Backfill benefit grant events

Revision ID: af13a9af270c
Revises: 133b23057e2f
Create Date: 2025-05-20 14:49:54.923799

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "af13a9af270c"
down_revision = "133b23057e2f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO events (
            id,
            timestamp,
            ingested_at,
            organization_id,
            customer_id,
            source,
            name,
            user_metadata
        )
        SELECT
            uuid_generate_v4(),
            granted_at,
            granted_at,
            customers.organization_id,
            customers.id,
            'system',
            'benefit.granted',
            jsonb_build_object(
                'benefit_id', benefits.id,
                'benefit_grant_id', benefit_grants.id,
                'benefit_type', benefits.type
            )
        FROM benefit_grants
        JOIN benefits ON benefit_grants.benefit_id = benefits.id
        JOIN customers ON benefit_grants.customer_id = customers.id
        WHERE benefit_grants.granted_at IS NOT NULL
    """)

    op.execute("""
        INSERT INTO events (
            id,
            timestamp,
            ingested_at,
            organization_id,
            customer_id,
            source,
            name,
            user_metadata
        )
        SELECT
            uuid_generate_v4(),
            revoked_at,
            revoked_at,
            customers.organization_id,
            customers.id,
            'system',
            'benefit.revoked',
            jsonb_build_object(
                'benefit_id', benefits.id,
                'benefit_grant_id', benefit_grants.id,
                'benefit_type', benefits.type
            )
        FROM benefit_grants
        JOIN benefits ON benefit_grants.benefit_id = benefits.id
        JOIN customers ON benefit_grants.customer_id = customers.id
        WHERE benefit_grants.revoked_at IS NOT NULL
    """)


def downgrade() -> None:
    pass
