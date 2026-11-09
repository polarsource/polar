"""drop legacy backoffice staff columns

Revision ID: 145cc87944da
Revises: c503229afd0f
Create Date: 2026-11-09 12:51:46.414770

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "145cc87944da"
down_revision = "c503229afd0f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


PARTICIPANTS = "support_case_participants"
SUBJECT_CHECK = "support_case_participants_subject_matches_kind_check"
NEW_SUBJECT_CHECK = f"{SUBJECT_CHECK}_new"

BACKOFFICE_SUBJECT = (
    "(kind = 'platform' AND backoffice_platform_user_id IS NOT NULL "
    "AND organization_id IS NULL AND customer_id IS NULL) "
    "OR (kind = 'merchant' AND organization_id IS NOT NULL "
    "AND backoffice_platform_user_id IS NULL AND customer_id IS NULL) "
    "OR (kind = 'customer' AND customer_id IS NOT NULL "
    "AND backoffice_platform_user_id IS NULL AND organization_id IS NULL)"
)

TRANSITION_SUBJECT = (
    "(kind = 'platform' "
    "AND (platform_user_id IS NOT NULL OR backoffice_platform_user_id IS NOT NULL) "
    "AND organization_id IS NULL AND customer_id IS NULL) "
    "OR (kind = 'merchant' AND organization_id IS NOT NULL "
    "AND platform_user_id IS NULL AND backoffice_platform_user_id IS NULL "
    "AND customer_id IS NULL) "
    "OR (kind = 'customer' AND customer_id IS NOT NULL "
    "AND platform_user_id IS NULL AND backoffice_platform_user_id IS NULL "
    "AND organization_id IS NULL)"
)


def upgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(
        op.f(NEW_SUBJECT_CHECK), PARTICIPANTS, type_="check", if_exists=True
    )
    op.create_check_constraint(
        op.f(NEW_SUBJECT_CHECK),
        PARTICIPANTS,
        BACKOFFICE_SUBJECT,
        postgresql_not_valid=True,
    )

    # Release the exclusive lock and validate before dropping any legacy data.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.execute(
                f"ALTER TABLE {PARTICIPANTS} VALIDATE CONSTRAINT {NEW_SUBJECT_CHECK}"
            )
        finally:
            op.execute("RESET lock_timeout")

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(op.f(SUBJECT_CHECK), PARTICIPANTS, type_="check")
    op.drop_column("support_case_participants", "platform_user_id")
    op.execute(
        f"ALTER TABLE {PARTICIPANTS} RENAME CONSTRAINT {NEW_SUBJECT_CHECK} TO {SUBJECT_CHECK}"
    )
    op.drop_column("organization_review_feedback", "reviewer_id")
    op.drop_column("support_cases", "assigned_user_id")
    op.drop_column("users", "is_admin")


def downgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration.
    # CREATE INDEX CONCURRENTLY needs its own, far larger timeout -- see ADR-0006.
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(op.f(SUBJECT_CHECK), PARTICIPANTS, type_="check")
    op.add_column(
        "users",
        sa.Column(
            "is_admin",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=True,
        ),
    )
    op.add_column(
        "support_cases",
        sa.Column("assigned_user_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        op.f("support_cases_assigned_user_id_fkey"),
        "support_cases",
        "users",
        ["assigned_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_support_cases_assigned_user_id"),
        "support_cases",
        ["assigned_user_id"],
        unique=False,
    )
    op.add_column(
        "support_case_participants",
        sa.Column("platform_user_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        op.f("support_case_participants_platform_user_id_fkey"),
        "support_case_participants",
        "users",
        ["platform_user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_support_case_participants_unique_platform_user"),
        "support_case_participants",
        ["case_id", "platform_user_id"],
        unique=True,
        postgresql_where="((platform_user_id IS NOT NULL) AND (deleted_at IS NULL))",
    )
    op.add_column(
        "organization_review_feedback",
        sa.Column("reviewer_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        op.f("organization_review_feedback_reviewer_id_fkey"),
        "organization_review_feedback",
        "users",
        ["reviewer_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_organization_review_feedback_reviewer_id"),
        "organization_review_feedback",
        ["reviewer_id"],
        unique=False,
    )
    op.create_check_constraint(op.f(SUBJECT_CHECK), PARTICIPANTS, TRANSITION_SUBJECT)
