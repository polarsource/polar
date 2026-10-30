from uuid import UUID

from sqlalchemy import Select, exists
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import aliased

from polar.auth.models import AuthSubject, Customer, Member, is_member
from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.models.downloadable import Downloadable, DownloadableStatus
from polar.models.file import File
from polar.postgres import sql


class DownloadableRepository(RepositoryBase[Downloadable]):
    model = Downloadable

    async def upsert_granted(
        self,
        *,
        file_id: UUID,
        customer_id: UUID,
        benefit_id: UUID,
        member_id: UUID | None,
    ) -> Downloadable:
        # Atomic upsert keyed on the member-aware scope. index_where matches the
        # partial unique index ix_downloadables_scope_unique; on conflict we just
        # (re)grant, flipping a previously revoked row back to granted.
        insert_statement = pg_insert(Downloadable).values(
            file_id=file_id,
            customer_id=customer_id,
            benefit_id=benefit_id,
            member_id=member_id,
            status=DownloadableStatus.granted,
        )
        statement = (
            insert_statement.on_conflict_do_update(
                index_elements=[
                    Downloadable.customer_id,
                    Downloadable.member_id,
                    Downloadable.file_id,
                    Downloadable.benefit_id,
                ],
                index_where=Downloadable.deleted_at.is_(None),
                set_={"status": insert_statement.excluded.status},
            )
            .returning(Downloadable)
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(statement)
        return result.scalars().one()

    async def repoint_benefit(
        self,
        *,
        customer_id: UUID,
        member_id: UUID | None,
        benefit_id: UUID,
        new_benefit_id: UUID,
    ) -> None:
        """Move the downloadables of a benefit to another benefit.

        A file the customer already has through the other benefit keeps that row,
        so the previous one is deleted instead of violating the scope uniqueness.
        """
        scope = (
            Downloadable.customer_id == customer_id,
            Downloadable.member_id.is_not_distinct_from(member_id),
            Downloadable.benefit_id == benefit_id,
            Downloadable.deleted_at.is_(None),
        )
        existing = aliased(Downloadable)
        await self.session.execute(
            sql.update(Downloadable)
            .where(
                *scope,
                ~exists().where(
                    existing.customer_id == Downloadable.customer_id,
                    existing.member_id.is_not_distinct_from(Downloadable.member_id),
                    existing.file_id == Downloadable.file_id,
                    existing.benefit_id == new_benefit_id,
                    existing.deleted_at.is_(None),
                ),
            )
            .values(benefit_id=new_benefit_id)
        )
        await self.session.execute(
            sql.update(Downloadable).where(*scope).values(deleted_at=utc_now())
        )

    def get_customer_statement(
        self, auth_subject: AuthSubject[Customer | Member]
    ) -> Select[tuple[Downloadable]]:
        from polar.models import Benefit

        statement = (
            sql.select(Downloadable)
            .join(File)
            .join(Benefit)
            .where(
                Downloadable.status == DownloadableStatus.granted,
                ~Downloadable.is_deleted,
                ~File.is_deleted,
                File.is_uploaded == True,
                File.is_enabled == True,
                File.flagged_malicious_at.is_(None),
                ~Benefit.is_deleted,
            )
            .order_by(Downloadable.created_at.desc())
        )

        if is_member(auth_subject):
            statement = statement.where(
                Downloadable.member_id == auth_subject.subject.id,
            )
        else:
            statement = statement.where(
                Downloadable.customer_id == auth_subject.subject.id,
            )

        return statement
