from githubkit import (
    AppAuthStrategy,
    AppInstallationAuthStrategy,
    GitHub,
    TokenAuthStrategy,
)

from polar.config import settings


def get_client(access_token: str) -> GitHub[TokenAuthStrategy]:
    return GitHub(access_token)


def get_app_client() -> GitHub[AppAuthStrategy]:
    return GitHub(
        AppAuthStrategy(
            app_id=settings.GITHUB_APP_IDENTIFIER,
            private_key=settings.GITHUB_APP_PRIVATE_KEY,
            client_id=settings.GITHUB_CLIENT_ID,
            client_secret=settings.GITHUB_CLIENT_SECRET,
        )
    )


def get_app_installation_client(
    installation_id: int,
) -> GitHub[AppInstallationAuthStrategy]:
    return GitHub(
        AppInstallationAuthStrategy(
            app_id=settings.GITHUB_APP_IDENTIFIER,
            private_key=settings.GITHUB_APP_PRIVATE_KEY,
            installation_id=installation_id,
            client_id=settings.GITHUB_CLIENT_ID,
            client_secret=settings.GITHUB_CLIENT_SECRET,
        )
    )
