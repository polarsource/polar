"""Authentication and authorization for Agent Core."""

from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

# Agent management (admin/merchant)
_AgentRead = Authenticator(
    required_scopes={Scope.web_default, Scope.products_read},
    allowed_subjects={User, Organization},
)

_AgentWrite = Authenticator(
    required_scopes={Scope.web_default, Scope.products_write},
    allowed_subjects={User, Organization},
)

AgentRead = Annotated[AuthSubject[User | Organization], Depends(_AgentRead)]
AgentWrite = Annotated[AuthSubject[User | Organization], Depends(_AgentWrite)]

# Conversation access (can be anonymous for public chat)
_ConversationAccess = Authenticator(
    required_scopes=set(),  # No scopes required (public access)
    allowed_subjects={User, Organization},
)

ConversationAccess = Annotated[
    AuthSubject[User | Organization], Depends(_ConversationAccess)
]
