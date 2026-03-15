from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import MetricDashboard, MetricDefinition, UserOrganization


class MetricDefinitionRepository(
    RepositoryBase[MetricDefinition], RepositoryIDMixin[MetricDefinition, UUID]
):
    model = MetricDefinition

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[MetricDefinition]]:
        statement = self.get_base_statement().options(
            joinedload(MetricDefinition.meter)
        )

        if is_user(auth_subject):
            statement = statement.where(
                MetricDefinition.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                MetricDefinition.organization_id == auth_subject.subject.id
            )

        return statement


class MetricDashboardRepository(
    RepositoryBase[MetricDashboard], RepositoryIDMixin[MetricDashboard, UUID]
):
    model = MetricDashboard

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[MetricDashboard]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            statement = statement.where(
                MetricDashboard.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == auth_subject.subject.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                MetricDashboard.organization_id == auth_subject.subject.id
            )

        return statement
