from datetime import datetime

from pydantic import UUID4

from polar.benefit.schemas import BenefitID
from polar.kit.schemas import Schema
from polar.models.license_key import LicenseKeyStatus


class LicenseKeyCreate(Schema):
    user_id: UUID4
    benefit_id: BenefitID
    key: str
    status: LicenseKeyStatus
    activation_limit: int | None = None
    expires_at: datetime | None = None


class LicenseKeyUpdate(LicenseKeyCreate): ...
