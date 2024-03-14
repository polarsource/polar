from polar.kit.schemas import Schema


class GitHubInvitesBenefitRepository(Schema):
    organization_name: str
    repository_name: str
