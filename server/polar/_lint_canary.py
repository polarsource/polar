from typing import Any

from sqlalchemy import select

from polar.models import Organization


def _canary() -> Any:
    return select(Organization).subquery()
