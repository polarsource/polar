from datetime import datetime

from polar.kit.utils import utc_now
from polar.models import Account, Audit, Organization


def generate_audit_entry(
    account: Account,
    org: Organization,
    start_ts: datetime | None = None,
    end_ts: datetime | None = None,
) -> Audit:
    audit = Audit(
        account_id=account.id,
        organization_id=org.id,
        start_timestamp=start_ts or utc_now(),
        end_timestamp=end_ts or utc_now(),
        log={"method": "GET", "path": "/", "status": 200},
    )
    return audit
