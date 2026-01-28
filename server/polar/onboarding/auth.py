"""Onboarding auth dependencies."""

from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

OnboardingWrite = Annotated[
    AuthSubject[User],
    Depends(
        Authenticator(
            required_scopes={Scope.web_read},
            allowed_subjects={User},
        )
    ),
]
