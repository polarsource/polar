from polar.kit.schemas import Schema


class GitHubInvitesBenefitRepository(Schema):
    repository_owner: str
    repository_name: str


class GitHubInvitesBenefitRepositories(Schema):
    repositories: list[GitHubInvitesBenefitRepository]
