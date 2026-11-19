"""allow several manual grants that carry a license key

Revision ID: 9c2e6d1f4a7b
Revises: 4b930dd42c3c
Create Date: 2026-11-19 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "9c2e6d1f4a7b"
down_revision = "4b930dd42c3c"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None

TABLE = "benefit_grants"
COLUMNS = ["customer_id", "member_id", "benefit_id"]
ACTIVE_MANUAL = (
    "deleted_at IS NULL AND manually_granted_at IS NOT NULL "
    "AND manually_revoked_at IS NULL"
)
OLD_INDEX = "ix_benefit_grants_active_manual_unique"
NEW_INDEX = "ix_benefit_grants_active_unkeyed_manual_unique"
NEW_PREDICATE = f"{ACTIVE_MANUAL} AND properties->>'user_provided_key' IS NULL"


def _drop_index(name: str) -> None:
    op.drop_index(name, table_name=TABLE, if_exists=True, postgresql_concurrently=True)


def _create_index(name: str, predicate: str) -> None:
    valid = (
        None
        if op.get_context().as_sql
        else op.get_bind().scalar(
            sa.text(
                "SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass(:name)"
            ),
            {"name": name},
        )
    )
    if valid:
        return
    if valid is False:
        _drop_index(name)
    try:
        op.create_index(
            name,
            TABLE,
            COLUMNS,
            unique=True,
            postgresql_concurrently=True,
            postgresql_nulls_not_distinct=True,
            postgresql_where=sa.text(predicate),
        )
    except sa.exc.IntegrityError:
        _drop_index(name)
        raise


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            _create_index(NEW_INDEX, NEW_PREDICATE)
            _drop_index(OLD_INDEX)
        finally:
            op.execute("RESET lock_timeout")


def downgrade() -> None:
    if not op.get_context().as_sql:
        duplicates = op.get_bind().scalar(
            sa.text(
                f"SELECT count(*) FROM (SELECT 1 FROM {TABLE} WHERE {ACTIVE_MANUAL} "
                "GROUP BY customer_id, member_id, benefit_id "
                "HAVING count(*) > 1) AS duplicates"
            )
        )
        if duplicates:
            raise RuntimeError(
                f"{duplicates} recipients hold several active manual grants of one "
                "benefit, which the previous unique index forbids. Revoke the extra "
                "license key grants before downgrading."
            )
    with op.get_context().autocommit_block():
        op.execute("SET lock_timeout = '5min'")
        try:
            _create_index(OLD_INDEX, ACTIVE_MANUAL)
            _drop_index(NEW_INDEX)
        finally:
            op.execute("RESET lock_timeout")
