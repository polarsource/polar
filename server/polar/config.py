import os
import uuid
from enum import Enum
from functools import cached_property

from pydantic import PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    development = "development"
    testing = "testing"
    staging = "staging"
    production = "production"


class EmailSender(str, Enum):
    logger = "logger"
    resend = "resend"


env = Environment(os.getenv("POLAR_ENV", Environment.development))
env_file = ".env.testing" if env == Environment.testing else ".env"


class Settings(BaseSettings):
    ENV: Environment = Environment.development
    DEBUG: bool = False
    LOG_LEVEL: str = "DEBUG"
    TESTING: bool = False

    SECRET: str = "super secret jwt secret"

    # Custom domain auth and exchange secrets
    CUSTOM_DOMAIN_JWT_KEY: str = "SETME! secret key used for custom domain auth"
    CUSTOM_DOMAIN_FORWARD_SECRET: str = "SETME! pre shared secret for exchanging a JWT to a auth JWT"  # pre shared key with the nextjs web app

    # JSON list of accepted CORS origins
    CORS_ORIGINS: list[str] = []

    ALLOWED_HOSTS: set[str] = {"127.0.0.1:3000", "localhost:3000"}

    # Base URL for the backend. Used by generate_external_url to
    # generate URLs to the backend accessible from the outside.
    BASE_URL: str = "http://127.0.0.1:8000/api/v1"

    # URL to frontend app.
    # Update to ngrok domain or similar in case you want
    # working Github badges in development.
    FRONTEND_BASE_URL: str = "http://127.0.0.1:3000"
    FRONTEND_DEFAULT_RETURN_PATH: str = "/feed"

    # Auth cookie
    AUTH_COOKIE_KEY: str = "polar_session"
    AUTH_COOKIE_TTL_SECONDS: int = 60 * 60 * 24 * 31  # 31 days
    AUTH_COOKIE_DOMAIN: str = "127.0.0.1"

    # Magic link
    MAGIC_LINK_TTL_SECONDS: int = 60 * 30  # 30 minutes

    # Postgres
    POSTGRES_SCHEME: str = "postgresql+asyncpg"
    POSTGRES_USER: str = "polar"
    POSTGRES_PWD: str = "polar"
    POSTGRES_HOST: str = "127.0.0.1"
    POSTGRES_PORT: int = 5432
    POSTGRES_DATABASE: str = "polar_development"

    # Redis
    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6379

    # Github App
    GITHUB_APP_NAMESPACE: str = ""  # Unused
    GITHUB_APP_IDENTIFIER: str = ""
    GITHUB_APP_WEBHOOK_SECRET: str = ""
    GITHUB_APP_PRIVATE_KEY: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_POLAR_USER_ACCESS_TOKEN: str | None = None

    # GitHub App for repository benefits
    GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE: str = ""
    GITHUB_REPOSITORY_BENEFITS_APP_IDENTIFIER: str = ""
    GITHUB_REPOSITORY_BENEFITS_APP_PRIVATE_KEY: str = ""
    GITHUB_REPOSITORY_BENEFITS_CLIENT_ID: str = ""
    GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET: str = ""

    # Discord
    DISCORD_CLIENT_ID: str = ""
    DISCORD_CLIENT_SECRET: str = ""
    DISCORD_BOT_TOKEN: str = ""
    DISCORD_BOT_PERMISSIONS: str = (
        "268435459"  # Manage Roles, Kick Members, Create Instant Invite
    )

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    # Stripe webhook secrets
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_CONNECT_WEBHOOK_SECRET: str = ""

    # Open Collective
    OPEN_COLLECTIVE_PERSONAL_TOKEN: str | None = None

    # Sentry
    SENTRY_DSN: str | None = None

    # Discord
    DISCORD_WEBHOOK_URL: str | None = None
    FAVICON_URL: str = "https://raw.githubusercontent.com/polarsource/polar/2648cf7472b5128704a097cd1eb3ae5f1dd847e5/docs/docs/assets/favicon.png"
    THUMBNAIL_URL: str = "https://raw.githubusercontent.com/polarsource/polar/4fd899222e200ca70982f437039f549b7a822ecc/clients/apps/web/public/email-logo-dark.png"

    # Posthog
    POSTHOG_PROJECT_API_KEY: str = ""

    # Loops
    LOOPS_API_KEY: str | None = None

    # Prometheus
    PROMETHEUS_EXPORTER_HTTP_PASSWORD: str = ""

    # Application behaviours
    API_PAGINATION_MAX_LIMIT: int = 100

    AUTO_SUBSCRIBE_SUBSCRIPTION_TIER_ID: uuid.UUID | None = None

    GITHUB_BADGE_EMBED: bool = False
    GITHUB_BADGE_EMBED_DEFAULT_LABEL: str = "Fund"

    EMAIL_SENDER: EmailSender = EmailSender.logger
    RESEND_API_KEY: str = ""

    ACCOUNT_BALANCE_REVIEW_THRESHOLD: int = 10000

    SUBSCRIPTION_FEE_PERCENT: int = 5
    PLEDGE_FEE_PERCENT: int = 5

    # Default organization setting for minimum pledge amount ($20)
    MINIMUM_ORG_PLEDGE_AMOUNT: int = 2000

    model_config = SettingsConfigDict(
        env_prefix="polar_",
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_file=env_file,
        extra="allow",
    )

    @field_validator("GITHUB_APP_PRIVATE_KEY", mode="before")
    @classmethod
    def validate_github_rsa_key(cls, v: str) -> str:
        if not (
            v.startswith("-----BEGIN RSA PRIVATE KEY")
            or v.endswith("END RSA PRIVATE KEY-----")
        ):
            raise ValueError("GITHUB_APP_PRIVATE_KEY must be a valid RSA key")
        return v

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}"

    @cached_property
    def postgres_dsn(self) -> str:
        return str(
            PostgresDsn.build(
                scheme=self.POSTGRES_SCHEME,
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PWD,
                host=self.POSTGRES_HOST,
                port=self.POSTGRES_PORT,
                path=self.POSTGRES_DATABASE,
            )
        )

    def is_environment(self, environment: Environment) -> bool:
        return self.ENV == environment

    def is_development(self) -> bool:
        return self.is_environment(Environment.development)

    def is_testing(self) -> bool:
        return self.is_environment(Environment.testing)

    def is_staging(self) -> bool:
        return self.is_environment(Environment.staging)

    def is_production(self) -> bool:
        return self.is_environment(Environment.production)

    def generate_external_url(self, path: str) -> str:
        return f"{self.BASE_URL}{path}"

    def generate_frontend_url(self, path: str) -> str:
        return f"{self.FRONTEND_BASE_URL}{path}"


settings = Settings()
