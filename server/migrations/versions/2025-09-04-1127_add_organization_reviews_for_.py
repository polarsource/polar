"""add organization reviews for grandfathered organizations

Revision ID: 25b8cacd8269
Revises: f3109d4baff8
Create Date: 2025-09-04 11:27:21.127990

"""

from datetime import UTC, datetime, timezone

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "25b8cacd8269"
down_revision = "f3109d4baff8"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    """Add organization reviews for grandfathered organizations."""
    # Cutoff date: August 4, 2025, 9:00 AM UTC
    cutoff_date = datetime(2025, 8, 4, 9, 0, tzinfo=UTC)
    current_time = datetime.now(UTC)

    # Insert organization reviews for all organizations created before the cutoff date
    op.execute(f"""
        INSERT INTO organization_reviews (
            id,
            organization_id,
            verdict,
            risk_score,
            violated_sections,
            reason,
            timed_out,
            model_used,
            organization_details_snapshot,
            validated_at,
            created_at,
            modified_at
        )
        SELECT
            gen_random_uuid() as id,
            o.id as organization_id,
            'PASS' as verdict,
            0.0 as risk_score,
            '[]'::jsonb as violated_sections,
            'Grandfathered organization' as reason,
            false as timed_out,
            'grandfathered' as model_used,
            COALESCE(o.details, '{{}}'::jsonb) as organization_details_snapshot,
            '{current_time.isoformat()}' as validated_at,
            '{current_time.isoformat()}' as created_at,
            '{current_time.isoformat()}' as modified_at
        FROM organizations o
        WHERE o.created_at < '{cutoff_date.isoformat()}'
        AND NOT EXISTS (
            SELECT 1 FROM organization_reviews r
            WHERE r.organization_id = o.id
        );
    """)


def downgrade() -> None:
    """Remove organization reviews for grandfathered organizations."""
    # Remove only the reviews created by this migration (identified by model_used = 'grandfathered')
    op.execute("""
        DELETE FROM organization_reviews
        WHERE model_used = 'grandfathered'
        AND reason = 'Grandfathered organization';
    """)
