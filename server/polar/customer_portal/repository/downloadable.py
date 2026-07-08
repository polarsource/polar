from uuid import UUID

from sqlalchemy import Select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from polar.auth.models import AuthSubject, Customer, Member, is_member
from polar.kit.repository import RepositoryBase
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
                Downloadable.is_deleted.is_(False),
                File.is_deleted.is_(False),
                File.is_uploaded == True,  # noqa: E712
                File.is_enabled == True,  # noqa: E712
                File.flagged_malicious_at.is_(None),
                Benefit.is_deleted.is_(False),
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
