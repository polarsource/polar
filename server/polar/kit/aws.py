from polar.config import settings


def get_credentials() -> tuple[str | None, str | None]:
    """Static keys when running locally, None otherwise so boto3's default chain
    resolves the assumed role."""
    if settings.is_development() or settings.is_testing():
        return settings.AWS_ACCESS_KEY_ID, settings.AWS_SECRET_ACCESS_KEY
    return None, None
