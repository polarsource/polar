"""Add EventActor

Revision ID: 58a3452292ee
Revises: 9c8d7e6f5a4b
Create Date: 2026-01-15

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "58a3452292ee"
down_revision = "9c8d7e6f5a4b"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Create event_actors table
    op.create_table(
        "event_actors",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("modified_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("external_customer_id", sa.String(), nullable=True),
        sa.Column("member_id", sa.Uuid(), nullable=True),
        sa.Column("external_member_id", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("event_actors_organization_id_fkey"),
            ondelete="cascade",
        ),
        sa.ForeignKeyConstraint(
            ["customer_id"],
            ["customers.id"],
            name=op.f("event_actors_customer_id_fkey"),
            ondelete="set null",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("event_actors_pkey")),
        sa.CheckConstraint(
            "customer_id IS NOT NULL OR external_customer_id IS NOT NULL "
            "OR member_id IS NOT NULL OR external_member_id IS NOT NULL",
            name="event_actors_has_identifier",
        ),
    )

    # Basic indexes
    op.create_index(
        op.f("ix_event_actors_organization_id"),
        "event_actors",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_actors_customer_id"),
        "event_actors",
        ["customer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_actors_external_customer_id"),
        "event_actors",
        ["external_customer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_actors_member_id"),
        "event_actors",
        ["member_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_event_actors_external_member_id"),
        "event_actors",
        ["external_member_id"],
        unique=False,
    )

    # Partial unique indexes for organization-scoped uniqueness
    op.execute(
        """
        CREATE UNIQUE INDEX ix_event_actors_org_customer_id
        ON event_actors (organization_id, customer_id)
        WHERE customer_id IS NOT NULL AND deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX ix_event_actors_org_external_customer_id
        ON event_actors (organization_id, external_customer_id)
        WHERE external_customer_id IS NOT NULL AND deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX ix_event_actors_org_member_id
        ON event_actors (organization_id, member_id)
        WHERE member_id IS NOT NULL AND deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX ix_event_actors_org_external_member_id
        ON event_actors (organization_id, external_member_id)
        WHERE external_member_id IS NOT NULL AND deleted_at IS NULL
        """
    )

    # Add event_actor_id to events table
    op.add_column("events", sa.Column("event_actor_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("events_event_actor_id_fkey"),
        "events",
        "event_actors",
        ["event_actor_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_events_event_actor_id"),
        "events",
        ["event_actor_id"],
        unique=False,
    )

    # Composite index for efficient filtering by org + event_actor + timestamp
    op.create_index(
        "ix_events_org_event_actor_timestamp",
        "events",
        ["organization_id", "event_actor_id", sa.text("timestamp DESC")],
    )

    # Composite index for efficient filtering by org + event_actor + ingested_at
    # (mirrors existing ix_events_organization_customer_id_ingested_at_desc)
    op.create_index(
        "ix_events_organization_event_actor_id_ingested_at_desc",
        "events",
        ["organization_id", "event_actor_id", sa.text("ingested_at DESC")],
    )


def downgrade() -> None:
    # Remove event_actor_id from events
    op.drop_index(
        "ix_events_organization_event_actor_id_ingested_at_desc", table_name="events"
    )
    op.drop_index("ix_events_org_event_actor_timestamp", table_name="events")
    op.drop_index(op.f("ix_events_event_actor_id"), table_name="events")
    op.drop_constraint(op.f("events_event_actor_id_fkey"), "events", type_="foreignkey")
    op.drop_column("events", "event_actor_id")

    # Drop partial unique indexes
    op.drop_index("ix_event_actors_org_external_member_id", table_name="event_actors")
    op.drop_index("ix_event_actors_org_member_id", table_name="event_actors")
    op.drop_index("ix_event_actors_org_external_customer_id", table_name="event_actors")
    op.drop_index("ix_event_actors_org_customer_id", table_name="event_actors")

    # Drop basic indexes
    op.drop_index(op.f("ix_event_actors_external_member_id"), table_name="event_actors")
    op.drop_index(op.f("ix_event_actors_member_id"), table_name="event_actors")
    op.drop_index(
        op.f("ix_event_actors_external_customer_id"), table_name="event_actors"
    )
    op.drop_index(op.f("ix_event_actors_customer_id"), table_name="event_actors")
    op.drop_index(op.f("ix_event_actors_organization_id"), table_name="event_actors")

    # Drop table
    op.drop_table("event_actors")
