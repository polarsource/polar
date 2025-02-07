from typing import Literal

from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitGitHubRepositoryProperties(BenefitProperties):
    repository_owner: str
    repository_name: str
    permission: Literal["pull", "triage", "push", "maintain", "admin"]


class BenefitGrantGitHubRepositoryProperties(BenefitGrantProperties, total=False):
    account_id: str
    repository_owner: str
    repository_name: str
    permission: Literal["pull", "triage", "push", "maintain", "admin"]
