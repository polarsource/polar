from polar.kit.schemas import Schema


class GitHubInvitesBenefitRepository(Schema):
    repository_owner: str
    repository_name: str


class GitHubInvitesBenefitOrganization(Schema):
    name: str
    is_personal: bool
    plan_name: str
    is_free: bool


class GitHubInvitesBenefitRepositories(Schema):
    repositories: list[GitHubInvitesBenefitRepository]
    organizations: list[GitHubInvitesBenefitOrganization]
