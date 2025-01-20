import functools
from typing import Any

from asgi_admin.integrations.sqlalchemy import RepositoryBase
from asgi_admin.views import ModelViewEdit, ModelViewGroup, ModelViewList
from sqlalchemy import Select, select

from polar.models import Account

from .base import get_repository


class AccountRepository(RepositoryBase[Account]):
    model = Account

    def get_pk(self, item: Account) -> Any:
        return item.id

    def get_title(self, item: Account) -> str:
        return str(item.id)

    def get_base_select(self) -> Select[tuple[Account]]:
        return select(Account).where(Account.deleted_at.is_(None))


account_viewgroup = ModelViewGroup[Account](
    "/accounts",
    "accounts",
    title="Accounts",
    get_repository=functools.partial(get_repository, AccountRepository),
    index_view="list",
    children=[
        ModelViewList[Account](
            path="/",
            name="list",
            title="List",
            fields=(
                ("id", "ID"),
                ("status", "Status"),
                ("account_type", "Type"),
                ("created_at", "Created At"),
                ("next_review_threshold", "Next Review Threshold"),
            ),
            query_fields=("id", "status", "account_type"),
        ),
        ModelViewEdit[Account](
            path="/{pk}",
            name="edit",
            title="Edit",
            fields=tuple(),
        ),
    ],
)

__all__ = ["account_viewgroup"]
