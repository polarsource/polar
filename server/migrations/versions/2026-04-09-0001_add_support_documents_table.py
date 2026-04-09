"""Add support_documents table

Revision ID: f1a2b3c4d5e6
Revises: ad9ec49d44d2
Create Date: 2026-04-09 00:01:00.000000

"""

import sqlalchemy as sa
from alembic import op
from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "f1a2b3c4d5e6"
down_revision = "b3af3591c62d"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.create_table(
        "support_documents",
        sa.Column(
            "id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("search_vector", postgresql.TSVECTOR(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index(
        "ix_support_documents_created_at",
        "support_documents",
        ["created_at"],
    )
    op.create_index(
        "ix_support_documents_deleted_at",
        "support_documents",
        ["deleted_at"],
    )
    op.create_index(
        "ix_support_documents_search_vector",
        "support_documents",
        ["search_vector"],
        unique=False,
        postgresql_using="gin",
    )

    public_support_documents_search_vector_update = PGFunction(
        schema="public",
        signature="support_documents_search_vector_update()",
        definition=(
            "RETURNS trigger AS $$\n"
            "BEGIN\n"
            "    NEW.search_vector := to_tsvector(\n"
            "        'english',\n"
            "        coalesce(NEW.title, '') || ' ' ||\n"
            "        coalesce(NEW.description, '') || ' ' ||\n"
            "        coalesce(NEW.content, '')\n"
            "    );\n"
            "    RETURN NEW;\n"
            "END\n"
            "$$ LANGUAGE plpgsql"
        ),
    )
    op.create_entity(public_support_documents_search_vector_update)

    public_support_documents_search_vector_trigger = PGTrigger(
        schema="public",
        signature="support_documents_search_vector_trigger",
        on_entity="public.support_documents",
        is_constraint=False,
        definition=(
            "BEFORE INSERT OR UPDATE ON support_documents\n"
            "FOR EACH ROW EXECUTE FUNCTION support_documents_search_vector_update()"
        ),
    )
    op.create_entity(public_support_documents_search_vector_trigger)


def downgrade() -> None:
    public_support_documents_search_vector_trigger = PGTrigger(
        schema="public",
        signature="support_documents_search_vector_trigger",
        on_entity="public.support_documents",
        is_constraint=False,
        definition=(
            "BEFORE INSERT OR UPDATE ON support_documents\n"
            "FOR EACH ROW EXECUTE FUNCTION support_documents_search_vector_update()"
        ),
    )
    op.drop_entity(public_support_documents_search_vector_trigger)

    public_support_documents_search_vector_update = PGFunction(
        schema="public",
        signature="support_documents_search_vector_update()",
        definition=(
            "RETURNS trigger AS $$\n"
            "BEGIN\n"
            "    NEW.search_vector := to_tsvector(\n"
            "        'english',\n"
            "        coalesce(NEW.title, '') || ' ' ||\n"
            "        coalesce(NEW.description, '') || ' ' ||\n"
            "        coalesce(NEW.content, '')\n"
            "    );\n"
            "    RETURN NEW;\n"
            "END\n"
            "$$ LANGUAGE plpgsql"
        ),
    )
    op.drop_entity(public_support_documents_search_vector_update)

    op.drop_index(
        "ix_support_documents_search_vector",
        table_name="support_documents",
        postgresql_using="gin",
    )
    op.drop_index("ix_support_documents_deleted_at", table_name="support_documents")
    op.drop_index("ix_support_documents_created_at", table_name="support_documents")
    op.drop_table("support_documents")
