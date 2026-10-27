from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import Agent, AuthSubject, Organization, User
from polar.auth.scope import Scope

_BenefitsRead = Authenticator(
    required_scopes={
        Scope.benefits_read,
        Scope.benefits_write,
    },
    allowed_subjects={User, Organization, Agent},
)
BenefitsRead = Annotated[
    AuthSubject[User | Organization | Agent], Depends(_BenefitsRead)
]

_BenefitsWrite = Authenticator(
    required_scopes={
        Scope.benefits_write,
    },
    allowed_subjects={User, Organization, Agent},
)
BenefitsWrite = Annotated[
    AuthSubject[User | Organization | Agent], Depends(_BenefitsWrite)
]

# Not for unclaimed agents: grants expose the customers they're granted to, and a
# Slack benefit needs a Slack integration, which only a user can install.
_BenefitGrantsRead = Authenticator(
    required_scopes={
        Scope.benefits_read,
        Scope.benefits_write,
    },
    allowed_subjects={User, Organization},
)
BenefitGrantsRead = Annotated[
    AuthSubject[User | Organization], Depends(_BenefitGrantsRead)
]

_SlackBenefitsWrite = Authenticator(
    required_scopes={
        Scope.benefits_write,
    },
    allowed_subjects={User, Organization},
)
SlackBenefitsWrite = Annotated[
    AuthSubject[User | Organization], Depends(_SlackBenefitsWrite)
]
