import functools
from collections.abc import AsyncIterator
from operator import attrgetter

from asgi_admin.integrations.sqlalchemy import RepositoryBase
from asgi_admin.repository import Model
from asgi_admin.views import ModelView
from asgi_admin.viewsets import AdminViewSet, ModelViewSet
from sqlalchemy import Select, select
from starlette.requests import Request
from wtforms import StringField, validators

from polar.models import Organization


class OrganizationRepository(RepositoryBase[Organization]):
    model = Organization

    def get_base_select(self) -> Select[tuple[Organization]]:
        return select(Organization).where(Organization.deleted_at.is_(None))


async def get_repository(
    repository_class: type[RepositoryBase[Model]], request: Request
) -> AsyncIterator[RepositoryBase[Model]]:
    async with request.state.async_sessionmaker() as session:
        yield repository_class(session)
        await session.commit()


organization_viewset = ModelViewSet[Organization](
    "organizations",
    title="Organizations",
    get_repository=functools.partial(get_repository, OrganizationRepository),
    pk_getter=attrgetter("id"),
    item_title_getter=attrgetter("name"),
    list_fields=[
        ("id", "ID"),
        ("name", "Name"),
        ("slug", "Slug"),
        ("created_at", "Created At"),
    ],
    list_query_fields=["id", "name", "slug"],
    edit_fields=(
        (
            "name",
            StringField(
                "Name",
                validators=[validators.InputRequired(), validators.Length(min=3)],
            ),
        ),
    ),
)

admin_viewset = AdminViewSet()
admin_viewset.add_viewset(organization_viewset, "/organizations")

__all__ = ["admin_viewset"]
