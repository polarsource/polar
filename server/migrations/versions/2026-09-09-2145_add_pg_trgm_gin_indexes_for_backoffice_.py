"""add pg_trgm gin indexes for backoffice organization search

Revision ID: 1b299ae956f3
Revises: 382c4661fdb2
Create Date: 2026-09-09 21:45:27.915455

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "1b299ae956f3"
down_revision = "382c4661fdb2"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

NAME_INDEX = "ix_organizations_name_trgm"
SLUG_INDEX = "ix_organizations_slug_trgm"
EMAIL_INDEX = "ix_organizations_email_trgm"


def upgrade() -> None:
    # The backoffice organization search runs a leading-wildcard
    # `ILIKE '%q%'` across name/slug/email, which no btree index can serve, so
    # it seq-scans the now-large organizations table (recently hit the 30s
    # statement timeout). pg_trgm GIN indexes make those `ILIKE` predicates
    # index-backed. Built CONCURRENTLY so the deploy never locks the table.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # CREATE INDEX CONCURRENTLY cannot run inside a transaction; autocommit_block
    # commits the pending extension change and runs each build in autocommit.
    with op.get_context().autocommit_block():
        for index_name, expression in (
            (NAME_INDEX, "name"),
            # `slug` is CITEXT: `slug ILIKE ...` resolves to citext's operator,
            # which `gin_trgm_ops` (a `text` opclass) doesn't serve, so index
            # the `slug::text` expression the search casts to.
            (SLUG_INDEX, "(slug::text)"),
            (EMAIL_INDEX, "email"),
        ):
            # A previously-interrupted concurrent build leaves an INVALID index of
            # the same name; drop it first so a re-run doesn't fail on "already
            # exists".
            op.drop_index(
                index_name,
                table_name="organizations",
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                index_name,
                "organizations",
                [sa.text(f"{expression} gin_trgm_ops")],
                postgresql_concurrently=True,
                postgresql_using="gin",
            )


def downgrade() -> None:
    # Leave the pg_trgm extension in place; other indexes may rely on it.
    with op.get_context().autocommit_block():
        for index_name in (NAME_INDEX, SLUG_INDEX, EMAIL_INDEX):
            op.drop_index(
                index_name,
                table_name="organizations",
                if_exists=True,
                postgresql_concurrently=True,
            )
