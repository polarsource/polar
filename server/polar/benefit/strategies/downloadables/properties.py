from uuid import UUID

from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitDownloadablesProperties(BenefitProperties):
    archived: dict[UUID, bool]
    files: list[UUID]


class BenefitGrantDownloadablesProperties(BenefitGrantProperties, total=False):
    files: list[str]
