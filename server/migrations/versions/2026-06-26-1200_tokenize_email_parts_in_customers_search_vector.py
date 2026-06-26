"""Tokenize email parts in customers search_vector

Revision ID: e7118c4ae5d8
Revises: 46c188b1734f
Create Date: 2026-06-26 12:00:00.000000

"""

from alembic import op
from sqlalchemy import text

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "e7118c4ae5d8"
down_revision = "46c188b1734f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        text(
            """
            CREATE OR REPLACE FUNCTION public.customers_search_vector_update()
            RETURNS trigger AS $$
            BEGIN
                NEW.search_vector :=
                    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
                    setweight(to_tsvector('simple', coalesce(NEW.email, '')), 'A') ||
                    setweight(to_tsvector('simple', coalesce(
                        regexp_replace(NEW.email, '[@._-]', ' ', 'g'), ''
                    )), 'B');
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;
            """
        )
    )

    op.execute(
        text(
            """
            UPDATE customers
            SET search_vector =
                setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(email, '')), 'A') ||
                setweight(to_tsvector('simple', coalesce(
                    regexp_replace(email, '[@._-]', ' ', 'g'), ''
                )), 'B')
            WHERE email IS NOT NULL OR name IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    # No downgrade: rolling back the function definition would leave the
    # backfilled rows with the new tokenization in place.
    pass
