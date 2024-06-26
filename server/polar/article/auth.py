from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, Subject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_ArticlesReadOrAnonymous = Authenticator(
    allowed_subjects={Anonymous, User, Organization},
    required_scopes={Scope.web_default, Scope.articles_read},
)
ArticlesReadOrAnonymous = Annotated[
    AuthSubject[Subject], Depends(_ArticlesReadOrAnonymous)
]

_ArticlesWrite = Authenticator(
    allowed_subjects={User, Organization},
    required_scopes={Scope.web_default, Scope.articles_write},
)
ArticlesWrite = Annotated[AuthSubject[User | Organization], Depends(_ArticlesWrite)]
