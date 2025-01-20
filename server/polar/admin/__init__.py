from asgi_admin.views import AdminViewGroup, AdminViewIndex

from .account import account_viewgroup
from .organization import organization_viewgroup

admin_viewgroup = AdminViewGroup(
    index_view="index",
    children=[
        AdminViewIndex("/"),
        organization_viewgroup,
        account_viewgroup,
    ],
)

__all__ = ["admin_viewgroup"]
