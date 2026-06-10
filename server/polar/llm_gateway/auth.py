from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_LLMGatewayRead = Authenticator(
    required_scopes={
        Scope.llm_gateway_read,
        Scope.llm_gateway_write,
    },
    allowed_subjects={User, Organization},
)
LLMGatewayRead = Annotated[AuthSubject[User | Organization], Depends(_LLMGatewayRead)]

_LLMGatewayWrite = Authenticator(
    required_scopes={
        Scope.llm_gateway_write,
    },
    allowed_subjects={User, Organization},
)
LLMGatewayWrite = Annotated[AuthSubject[User | Organization], Depends(_LLMGatewayWrite)]
