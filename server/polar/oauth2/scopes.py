from polar.auth.permission import allowed_scopes_for_role
from polar.auth.scope import Scope
from polar.models.user_organization import OrganizationRole


def restrict_scope_to_role(scope: str, role: OrganizationRole) -> str:
    allowed = allowed_scopes_for_role(role)
    return " ".join(s for s in scope.split() if Scope(s) in allowed)
