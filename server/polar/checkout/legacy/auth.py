from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Anonymous, AuthSubject, User

_Checkout = Authenticator(
    required_scopes=None,
    allowed_subjects={User, Anonymous},
)
Checkout = Annotated[AuthSubject[User | Anonymous], Depends(_Checkout)]
