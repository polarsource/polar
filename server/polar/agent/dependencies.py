from polar.config import settings
from polar.exceptions import ResourceNotFound


def agent_sign_up_enabled() -> None:
    if not settings.AGENT_SIGN_UP_ENABLED:
        raise ResourceNotFound()
