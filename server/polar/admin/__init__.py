from collections.abc import AsyncIterator
from operator import attrgetter

from asgi_admin.admin import AdminBase
from asgi_admin.integrations.sqlalchemy import RepositoryBase
from asgi_admin.views import ModelView
from sqlalchemy import Select, select
from starlette.requests import Request
from wtforms import StringField, validators

from polar.models import Organization


class OrganizationRepository(RepositoryBase[Organization]):
    model = Organization

    def get_base_select(self) -> Select[tuple[Organization]]:
        return select(Organization).where(Organization.deleted_at.is_(None))


class OrganizationView(ModelView[Organization]):
    model = Organization
    model_id_getter = attrgetter("id")

    list_fields = ["id", "name", "slug", "created_at"]
    list_query_fields = ["id", "name", "slug"]

    edit_fields = (
        (
            "name",
            StringField(
                "Name",
                validators=[validators.InputRequired(), validators.Length(min=3)],
            ),
        ),
    )

    async def get_repository(
        self, request: Request
    ) -> AsyncIterator[OrganizationRepository]:
        async with request.state.async_sessionmaker() as session:
            yield OrganizationRepository(session)
            await session.commit()

    async def get_item_title(self, request: Request, item: Organization) -> str:
        return item.name


class Admin(AdminBase):
    views = [OrganizationView()]
    title = "Polar Admin"


admin = Admin()

__all__ = ["admin"]
