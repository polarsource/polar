from typing import Annotated, Literal

from pydantic import UUID4, Field
from pydantic.json_schema import SkipJsonSchema

from polar.kit.schemas import Schema
from polar.models.benefit import BenefitType

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
)

## GitHub Repository

Permission = Annotated[
    Literal["pull", "triage", "push", "maintain", "admin"],
    Field(
        description=(
            "The permission level to grant. "
            "Read more about roles and their permissions on "
            "[GitHub documentation](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization#permissions-for-each-role)."
        )
    ),
]
RepositoryOwner = Annotated[
    str,
    Field(description="The owner of the repository.", examples=["polarsource"]),
]
RepositoryName = Annotated[
    str,
    Field(description="The name of the repository.", examples=["private_repo"]),
]


class BenefitGitHubRepositoryCreateProperties(Schema):
    """
    Properties to create a benefit of type `github_repository`.
    """

    repository_owner: str = Field(
        description="The owner of the repository.", examples=["polarsource"]
    )
    repository_name: str = Field(
        description="The name of the repository.", examples=["private_repo"]
    )
    permission: Permission


class BenefitGitHubRepositoryProperties(Schema):
    """
    Properties for a benefit of type `github_repository`.
    """

    repository_owner: RepositoryOwner
    repository_name: RepositoryName
    permission: Permission
    repository_id: SkipJsonSchema[UUID4 | None] = Field(None, deprecated=True)


class BenefitGitHubRepositorySubscriberProperties(Schema):
    """
    Properties available to subscribers for a benefit of type `github_repository`.
    """

    repository_owner: RepositoryOwner
    repository_name: RepositoryName


class BenefitGitHubRepositoryCreate(BenefitCreateBase):
    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositoryCreateProperties


class BenefitGitHubRepositoryUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositoryCreateProperties | None = None


class BenefitGitHubRepository(BenefitBase):
    """
    A benefit of type `github_repository`.

    Use it to automatically invite your backers to a private GitHub repository.
    """

    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositoryProperties


class BenefitGitHubRepositorySubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.github_repository]
    properties: BenefitGitHubRepositorySubscriberProperties
