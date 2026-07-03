from enum import StrEnum

from pydantic import UUID4

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.merchant_migration import MerchantMigrationSourcePlatform


class PrecheckIssueLevel(StrEnum):
    blocker = "blocker"
    warning = "warning"


class PrecheckIssue(Schema):
    level: PrecheckIssueLevel
    code: str
    message: str
    source_id: str | None


class PrecheckReport(Schema):
    can_start: bool
    issues: list[PrecheckIssue]


class MerchantMigration(IDSchema, TimestampedSchema):
    organization_id: UUID4
    source_platform: MerchantMigrationSourcePlatform
