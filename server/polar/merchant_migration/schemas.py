from pydantic import UUID4

from polar.kit.schemas import IDSchema, TimestampedSchema
from polar.models.merchant_migration import MerchantMigrationSourcePlatform


class MerchantMigration(IDSchema, TimestampedSchema):
    organization_id: UUID4
    source_platform: MerchantMigrationSourcePlatform
