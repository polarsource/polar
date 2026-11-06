"""prepare backoffice support case participants

Revision ID: eaa094603a46
Revises: 4ab695c9eb05
Create Date: 2026-11-06 16:20:12.109874

"""

import sqlalchemy as sa
from alembic import op

revision = "eaa094603a46"
down_revision = "4ab695c9eb05"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

TABLE = "support_case_participants"
SUBJECT_CHECK = "support_case_participants_subject_matches_kind_check"
BACKOFFICE_INDEX = "ix_support_case_participants_unique_backoffice_user"

LEGACY_SUBJECT = (
    "(kind = 'platform' AND platform_user_id IS NOT NULL "
    "AND organization_id IS NULL AND customer_id IS NULL) "
    "OR (kind = 'merchant' AND organization_id IS NOT NULL "
    "AND platform_user_id IS NULL AND customer_id IS NULL) "
    "OR (kind = 'customer' AND customer_id IS NOT NULL "
    "AND platform_user_id IS NULL AND organization_id IS NULL)"
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
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            op.drop_index(
                BACKOFFICE_INDEX,
                table_name=TABLE,
                if_exists=True,
                postgresql_concurrently=True,
            )
            op.create_index(
                BACKOFFICE_INDEX,
                TABLE,
                ["case_id", "backoffice_platform_user_id"],
                unique=True,
                postgresql_concurrently=True,
                postgresql_where=sa.text(
                    "backoffice_platform_user_id IS NOT NULL AND deleted_at IS NULL"
                ),
            )
        finally:
            op.execute("RESET lock_timeout")

    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(op.f(SUBJECT_CHECK), TABLE, type_="check")
    op.create_check_constraint(
        op.f(SUBJECT_CHECK), TABLE, TRANSITION_SUBJECT, postgresql_not_valid=True
    )

    # Release the exclusive lock before scanning existing rows.
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5s'")
        try:
            op.execute(f"ALTER TABLE {TABLE} VALIDATE CONSTRAINT {SUBJECT_CHECK}")
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    op.execute("SET LOCAL lock_timeout = '5s'")
    op.drop_constraint(op.f(SUBJECT_CHECK), TABLE, type_="check")
    op.create_check_constraint(op.f(SUBJECT_CHECK), TABLE, LEGACY_SUBJECT)
    op.drop_index(BACKOFFICE_INDEX, table_name=TABLE)
