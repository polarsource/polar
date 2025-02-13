import functools
from typing import Any

from asgi_admin.integrations.sqlalchemy import RepositoryBase
from asgi_admin.views import ModelViewEdit, ModelViewGroup, ModelViewList
from sqlalchemy import Select, select
from starlette.requests import Request
from wtforms import Form, StringField, validators

from polar.models import Organization

from .base import get_repository


class OrganizationRepository(RepositoryBase[Organization]):
    model = Organization

    def get_pk(self, item: Organization) -> Any:
        return item.id

    def get_title(self, item: Organization) -> str:
        return item.name

    def get_base_select(self) -> Select[tuple[Organization]]:
        return select(Organization).where(Organization.deleted_at.is_(None))

    async def get_by_slug(self, slug: str) -> Organization | None:
        statement = self.get_base_select().where(Organization.slug == slug)
        return await self.get_one_or_none(statement)


async def validate_slug(
    request: Request,
    repository: OrganizationRepository,
    organization: Organization,
    form: Form,
) -> bool:
    if "slug" in form.data:
        existing = await repository.get_by_slug(form.data["slug"])
        if existing is not None and existing.id != organization.id:
            form.slug.errors.append("Slug already exists.")
            return False
    return True


organization_viewgroup = ModelViewGroup[Organization](
    "/organizations",
    "organizations",
    title="Organizations",
    get_repository=functools.partial(get_repository, OrganizationRepository),
    index_view="list",
    children=[
        ModelViewList[Organization](
            path="/",
            name="list",
            title="List",
            fields=(
                ("id", "ID"),
                ("name", "Name"),
                ("slug", "Slug"),
                ("created_at", "Created At"),
            ),
            query_fields=("id", "name", "slug"),
            details_view_name="edit",
        ),
        ModelViewEdit[Organization](
            path="/{pk}",
            name="edit",
            title="Edit",
            fields=(
                (
                    "name",
                    StringField(
                        "Name",
                        validators=[
                            validators.InputRequired(),
                            validators.Length(min=3),
                        ],
                    ),
                ),
                (
                    "slug",
                    StringField(
                        "Slug",
                        filters=[str.lower],
                        validators=[
                            validators.InputRequired(),
                            validators.Length(min=3),
                        ],
                    ),
                ),
            ),
            async_validators=[validate_slug],
        ),
    ],
)

__all__ = ["organization_viewgroup"]
