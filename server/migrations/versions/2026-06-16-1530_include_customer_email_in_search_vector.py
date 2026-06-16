"""Include customer email in search_vector

Revision ID: 7a3f0b9c2d1e
Revises: 1d8e332efb2f
Create Date: 2026-06-16 15:30:00.000000

"""

from alembic import op
from alembic_utils.pg_function import PGFunction

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7a3f0b9c2d1e"
down_revision = "1d8e332efb2f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    public_customers_search_vector_update = PGFunction(
        schema="public",
        signature="customers_search_vector_update()",
        definition="RETURNS trigger AS $$\n    BEGIN\n        NEW.search_vector :=\n            setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||\n            setweight(to_tsvector('simple', coalesce(NEW.email, '')), 'A');\n        RETURN NEW;\n    END\n    $$ LANGUAGE plpgsql",
    )
    op.replace_entity(public_customers_search_vector_update)


def downgrade() -> None:
    public_customers_search_vector_update = PGFunction(
        schema="public",
        signature="customers_search_vector_update()",
        definition="RETURNS trigger AS $$\n    BEGIN\n        NEW.search_vector := to_tsvector('simple', coalesce(NEW.name, ''));\n        RETURN NEW;\n    END\n    $$ LANGUAGE plpgsql",
    )
    op.replace_entity(public_customers_search_vector_update)
