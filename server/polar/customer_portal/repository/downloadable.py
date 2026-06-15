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
        from polar.models import Benefit, BenefitGrant

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
            member = auth_subject.subject
            # A downloadable's files are defined on the benefit, so any member
            # holding an active grant for that benefit is entitled to the same
            # files. We gate visibility on the member's benefit grants rather
            # than on Downloadable.member_id: a downloadable row is unique per
            # (customer, file, benefit) and shared across the customer's members,
            # so its member_id can only ever reference a single one of them (see
            # DownloadableService.grant_for_benefit_file).
            granted_benefit_ids = sql.select(BenefitGrant.benefit_id).where(
                BenefitGrant.member_id == member.id,
                BenefitGrant.is_granted.is_(True),
                BenefitGrant.is_deleted.is_(False),
            )
            statement = statement.where(
                Downloadable.customer_id == member.customer_id,
                Downloadable.benefit_id.in_(granted_benefit_ids),
            )
        else:
            statement = statement.where(
                Downloadable.customer_id == auth_subject.subject.id,
            )

        return statement
