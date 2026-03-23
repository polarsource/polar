from sqlalchemy import Select

from polar.auth.models import AuthSubject, Customer, Member, is_member
from polar.kit.repository import RepositoryBase
from polar.models.downloadable import Downloadable, DownloadableStatus
from polar.models.file import File
from polar.postgres import sql


class DownloadableRepository(RepositoryBase[Downloadable]):
    model = Downloadable

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
