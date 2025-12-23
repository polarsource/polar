import os
import tempfile
from datetime import timedelta
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Literal

from annotated_types import Ge
from pydantic import AfterValidator, DirectoryPath, Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

from polar.kit.address import Address, CountryAlpha2
from polar.kit.jwk import JWKSFile


class Environment(StrEnum):
    development = "development"
    testing = "testing"  # Used for running tests
    sandbox = "sandbox"
    production = "production"
    test = "test"  # Used for the test environment in Render


class EmailSender(StrEnum):
    logger = "logger"
    resend = "resend"


def _validate_email_renderer_binary_path(value: Path) -> Path:
    if not value.exists() and not value.is_file():
        raise ValueError(
            f"""
        The provided email renderer binary path {value} is not a valid file path
        or does not exist.\n
        If you're in local development, you should build the email renderer binary
        by running the following command:\n
        uv run task emails\n
        """
        )

    return value


env = Environment(os.getenv("POLAR_ENV", Environment.development))
if env == Environment.testing:
    env_file = ".env.testing"
elif env == Environment.test:
    env_file = ".env.test"
else:
    env_file = ".env"
file_extension = ".exe" if os.name == "nt" else ""


class Settings(BaseSettings):
    ENV: Environment = Environment.development
    SQLALCHEMY_DEBUG: bool = False
    POSTHOG_DEBUG: bool = False
    LOG_LEVEL: str = "DEBUG"
    TESTING: bool = False

    WORKER_HEALTH_CHECK_INTERVAL: timedelta = timedelta(seconds=30)
    WORKER_MAX_RETRIES: int = 20
    WORKER_MIN_BACKOFF_MILLISECONDS: int = 2_000
    WORKER_PROMETHEUS_DIR: Path = Path(tempfile.gettempdir()) / "prometheus_multiproc"

    # Prometheus Remote Write (for pushing metrics to Prometheus or Grafana Cloud)
    PROMETHEUS_REMOTE_WRITE_URL: str | None = None
    PROMETHEUS_REMOTE_WRITE_USERNAME: str | None = None
    PROMETHEUS_REMOTE_WRITE_PASSWORD: str | None = None
    PROMETHEUS_REMOTE_WRITE_INTERVAL: Annotated[int, Ge(1)] = 15  # seconds

    WEBHOOK_MAX_RETRIES: int = 10
    WEBHOOK_EVENT_RETENTION_PERIOD: timedelta = timedelta(days=30)
    WEBHOOK_FAILURE_THRESHOLD: int = 10

    CUSTOMER_METER_UPDATE_DEBOUNCE_MIN_THRESHOLD: timedelta = timedelta(seconds=5)
    CUSTOMER_METER_UPDATE_DEBOUNCE_MAX_THRESHOLD: timedelta = timedelta(minutes=15)

    # TimescaleDB Migration - dual-write to events_hyper table
    EVENTS_DUAL_WRITE_ENABLED: bool = False

    SECRET: str = "super secret jwt secret"
    JWKS: JWKSFile = Field(default="./.jwks.json")
    CURRENT_JWK_KID: str = "polar_dev"
    WWW_AUTHENTICATE_REALM: str = "polar"

    # JSON list of accepted CORS origins
    CORS_ORIGINS: list[str] = []

    ALLOWED_HOSTS: set[str] = {"127.0.0.1:3000", "localhost:3000"}

    # Base URL for the backend. Used by generate_external_url to
    # generate URLs to the backend accessible from the outside.
    BASE_URL: str = "http://127.0.0.1:8000"
    BACKOFFICE_HOST: str | None = None

    # URL to frontend app.
    # Update to ngrok domain or similar in case you want
    # working Github badges in development.
    FRONTEND_BASE_URL: str = "http://127.0.0.1:3000"
    FRONTEND_DEFAULT_RETURN_PATH: str = "/"
    CHECKOUT_BASE_URL: str = (
        "http://127.0.0.1:8000/v1/checkout-links/{client_secret}/redirect"
    )

    # User session
    USER_SESSION_TTL: timedelta = timedelta(days=31)
    USER_SESSION_COOKIE_KEY: str = "polar_session"
    USER_SESSION_COOKIE_DOMAIN: str = "127.0.0.1"

    # Customer session
    CUSTOMER_SESSION_TTL: timedelta = timedelta(hours=1)
    CUSTOMER_SESSION_CODE_TTL: timedelta = timedelta(minutes=30)
    CUSTOMER_SESSION_CODE_LENGTH: int = 6

    # Impersonation session
    IMPERSONATION_COOKIE_KEY: str = "polar_original_session"
    IMPERSONATION_INDICATOR_COOKIE_KEY: str = "polar_is_impersonating"

    # Login code
    LOGIN_CODE_TTL_SECONDS: int = 60 * 30  # 30 minutes
    LOGIN_CODE_LENGTH: int = 6

    # App Review bypass (for testing login flow during Apple/Google app reviews)
    APP_REVIEW_EMAIL: str | None = None
    APP_REVIEW_OTP_CODE: str | None = None

    # Email verification
    EMAIL_VERIFICATION_TTL_SECONDS: int = 60 * 30  # 30 minutes

    # Checkout
    CUSTOM_PRICE_PRESET_FALLBACK: Annotated[int, Ge(50)] = 10_00
    CHECKOUT_TTL_SECONDS: int = 60 * 60  # 1 hour
    IP_GEOLOCATION_DATABASE_DIRECTORY_PATH: DirectoryPath = Path(__file__).parent.parent
    IP_GEOLOCATION_DATABASE_NAME: str = "ip-geolocation.mmdb"
    USE_TEST_CLOCK: bool = False

    # Database
    POSTGRES_USER: str = "polar"
    POSTGRES_PWD: str = "polar"
    POSTGRES_HOST: str = "127.0.0.1"
    POSTGRES_PORT: int = 5432
    POSTGRES_DATABASE: str = "polar"
    DATABASE_POOL_SIZE: int = 5
    DATABASE_SYNC_POOL_SIZE: int = 1  # Specific pool size for sync connection: since we only use it in OAuth2 router, don't waste resources.
    DATABASE_POOL_RECYCLE_SECONDS: int = 600  # 10 minutes
    DATABASE_COMMAND_TIMEOUT_SECONDS: float = 30.0
    DATABASE_STREAM_YIELD_PER: int = 100

    POSTGRES_READ_USER: str | None = None
    POSTGRES_READ_PWD: str | None = None
    POSTGRES_READ_HOST: str | None = None
    POSTGRES_READ_PORT: int | None = None
    POSTGRES_READ_DATABASE: str | None = None

    # Redis
    REDIS_HOST: str = "127.0.0.1"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # Emails
    EMAIL_RENDERER_BINARY_PATH: Annotated[
        Path, AfterValidator(_validate_email_renderer_binary_path)
    ] = (
        Path(__file__).parent.parent
        / "emails"
        / "bin"
        / f"react-email-pkg{file_extension}"
    )
    EMAIL_SENDER: EmailSender = EmailSender.logger
    RESEND_API_KEY: str = ""
    RESEND_API_BASE_URL: str = "https://api.resend.com"
    EMAIL_FROM_NAME: str = "Polar"
    EMAIL_FROM_DOMAIN: str = "notifications.polar.sh"
    EMAIL_FROM_LOCAL: str = "mail"
    EMAIL_DEFAULT_REPLY_TO_NAME: str = "Polar Support"
    EMAIL_DEFAULT_REPLY_TO_EMAIL_ADDRESS: str = "support@polar.sh"

    # Github App
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

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

    # Google
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Apple
    APPLE_CLIENT_ID: str = ""
    APPLE_TEAM_ID: str = ""
    APPLE_KEY_ID: str = ""
    APPLE_KEY_VALUE: str = ""

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "o4-mini-2025-04-16"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    # Stripe webhook secrets
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_CONNECT_WEBHOOK_SECRET: str = ""
    STRIPE_STATEMENT_DESCRIPTOR: str = "POLAR"

    # Open Collective
    OPEN_COLLECTIVE_PERSONAL_TOKEN: str | None = None

    # Sentry
    SENTRY_DSN: str | None = None

    # Discord
    FAVICON_URL: str = "https://raw.githubusercontent.com/polarsource/polar/2648cf7472b5128704a097cd1eb3ae5f1dd847e5/docs/docs/assets/favicon.png"
    THUMBNAIL_URL: str = "https://raw.githubusercontent.com/polarsource/polar/4fd899222e200ca70982f437039f549b7a822ecc/clients/apps/web/public/email-logo-dark.png"

    # Posthog
    POSTHOG_PROJECT_API_KEY: str = ""

    # Loops
    LOOPS_API_KEY: str | None = None

    # Logo.dev (for company logo avatars)
    LOGO_DEV_PUBLISHABLE_KEY: str | None = None
    PERSONAL_EMAIL_DOMAINS: set[str] = {
        "gmail.com",
        "yahoo.com",
        "hotmail.com",
        "outlook.com",
        "aol.com",
        "icloud.com",
        "mail.com",
        "protonmail.com",
        "zoho.com",
        "gmx.com",
        "yandex.com",
        "msn.com",
        "live.com",
        "qq.com",
    }

    # Logfire
    LOGFIRE_TOKEN: str | None = None
    LOGFIRE_IGNORED_ACTORS: set[str] = {
        "organization_access_token.record_usage",
        "personal_access_token.record_usage",
    }

    # Plain
    PLAIN_REQUEST_SIGNING_SECRET: str | None = None
    PLAIN_TOKEN: str | None = None
    PLAIN_CHAT_SECRET: str | None = None

    # AWS (File Downloads)
    AWS_ACCESS_KEY_ID: str = "polar-development"
    AWS_SECRET_ACCESS_KEY: str = "polar123456789"
    AWS_REGION: str = "us-east-2"
    AWS_SIGNATURE_VERSION: str = "v4"

    # Downloadable files
    S3_FILES_BUCKET_NAME: str = "polar-s3"
    S3_FILES_PUBLIC_BUCKET_NAME: str = "polar-s3-public"
    S3_FILES_PRESIGN_TTL: int = 600  # 10 minutes
    S3_FILES_DOWNLOAD_SECRET: str = "supersecret"
    S3_FILES_DOWNLOAD_SALT: str = "saltysalty"
    # Override to http://127.0.0.1:9000 in .env during development
    S3_ENDPOINT_URL: str | None = None

    MINIO_USER: str = "polar"
    MINIO_PWD: str = "polarpolar"

    # Chargeback Stop
    CHARGEBACK_STOP_WEBHOOK_SECRET: str = ""

    # Invoices
    S3_CUSTOMER_INVOICES_BUCKET_NAME: str = "polar-customer-invoices"
    S3_PAYOUT_INVOICES_BUCKET_NAME: str = "polar-payout-invoices"
    INVOICES_NAME: str = "Polar Software, Inc."
    INVOICES_ADDRESS: Address = Address(
        line1="548 Market St",
        line2="PMB 61301",
        postal_code="94104",
        city="San Francisco",
        state="US-CA",
        country=CountryAlpha2("US"),
    )
    INVOICES_ADDITIONAL_INFO: str | None = "[support@polar.sh](mailto:support@polar.sh)"
    PAYOUT_INVOICES_PREFIX: str = "POLAR-"

    # Application behaviours
    API_PAGINATION_MAX_LIMIT: int = 100

    ACCOUNT_PAYOUT_DELAY: timedelta = timedelta(seconds=1)
    ACCOUNT_PAYOUT_MINIMUM_BALANCE: int = 1000

    _DEFAULT_ACCOUNT_PAYOUT_MINIMUM_BALANCE: int = 1000
    ACCOUNT_PAYOUT_MINIMUM_BALANCE_PER_PAYOUT_CURRENCY: dict[str, int] = {
        "all": 4000,
        "amd": 4000,
        "aoa": 3000,
        "azn": 4000,
        "bam": 4000,
        "bob": 4000,
        "btn": 4000,
        "chf": 1500,
        "clp": 4000,
        "cop": 5000,
        "eur": 1300,
        "gbp": 1500,
        "gmd": 4000,
        "gyd": 4000,
        "khr": 4000,
        "krw": 4000,
        "lak": 4000,
        "mdl": 4000,
        "mga": 4000,
        "mkd": 4000,
        "mnt": 4000,
        "myr": 4000,
        "mzn": 4000,
        "nad": 4000,
        "pyg": 4000,
        "rsd": 4000,
        "thb": 4000,
        "twd": 4000,
        "uzs": 4000,
        # USD, default
        "usd": _DEFAULT_ACCOUNT_PAYOUT_MINIMUM_BALANCE,
    }
    PLATFORM_FEE_BASIS_POINTS: int = 400
    PLATFORM_FEE_FIXED: int = 40

    ORGANIZATION_SLUG_RESERVED_KEYWORDS: list[str] = [
        # Landing pages
        "benefits",
        "donations",
        "issue-funding",
        "newsletters",
        "products",
        "careers",
        "legal",
        # App
        "docs",
        "login",
        "signup",
        "oauth2",
        "checkout",
        "embed",
        "maintainer",
        "dashboard",
        "feed",
        "for-you",
        "posts",
        "purchases",
        "funding",
        "rewards",
        "settings",
        "backoffice",
        "maintainer",
        "finance",
        # Misc
        ".well-known",
    ]

    ORGANIZATIONS_BILLING_ENGINE_DEFAULT: bool = True

    # Dunning Configuration
    DUNNING_RETRY_INTERVALS: list[timedelta] = [
        timedelta(days=2),  # First retry after 2 days
        timedelta(days=5),  # Second retry after 7 days (2 + 5)
        timedelta(days=7),  # Third retry after 14 days (2 + 5 + 7)
        timedelta(days=7),  # Fourth retry after 21 days (2 + 5 + 7 + 7)
    ]

    model_config = SettingsConfigDict(
        env_prefix="polar_",
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_file=env_file,
        extra="allow",
    )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    def get_postgres_dsn(self, driver: Literal["asyncpg", "psycopg2"]) -> str:
        return str(
            PostgresDsn.build(
                scheme=f"postgresql+{driver}",
                username=self.POSTGRES_USER,
                password=self.POSTGRES_PWD,
                host=self.POSTGRES_HOST,
                port=self.POSTGRES_PORT,
                path=self.POSTGRES_DATABASE,
            )
        )

    def is_read_replica_configured(self) -> bool:
        return all(
            [
                self.POSTGRES_READ_USER,
                self.POSTGRES_READ_PWD,
                self.POSTGRES_READ_HOST,
                self.POSTGRES_READ_PORT,
                self.POSTGRES_READ_DATABASE,
            ]
        )

    def get_postgres_read_dsn(
        self, driver: Literal["asyncpg", "psycopg2"]
    ) -> str | None:
        if not self.is_read_replica_configured():
            return None

        return str(
            PostgresDsn.build(
                scheme=f"postgresql+{driver}",
                username=self.POSTGRES_READ_USER,
                password=self.POSTGRES_READ_PWD,
                host=self.POSTGRES_READ_HOST,
                port=self.POSTGRES_READ_PORT,
                path=self.POSTGRES_READ_DATABASE,
            )
        )

    def is_environment(self, environments: set[Environment]) -> bool:
        return self.ENV in environments

    def is_development(self) -> bool:
        return self.is_environment({Environment.development})

    def is_testing(self) -> bool:
        return self.is_environment({Environment.testing})

    def is_sandbox(self) -> bool:
        return self.is_environment({Environment.sandbox})

    def is_production(self) -> bool:
        return self.is_environment({Environment.production})

    def is_test(self) -> bool:
        return self.is_environment({Environment.test})

    def generate_external_url(self, path: str) -> str:
        return f"{self.BASE_URL}{path}"

    def generate_frontend_url(self, path: str) -> str:
        return f"{self.FRONTEND_BASE_URL}{path}"

    def generate_backoffice_url(self, path: str) -> str:
        if self.BACKOFFICE_HOST is None:
            return self.generate_external_url(f"/backoffice{path}")
        return f"https://{self.BACKOFFICE_HOST}{path}"

    @property
    def stripe_descriptor_suffix_max_length(self) -> int:
        return 22 - len("* ") - len(self.STRIPE_STATEMENT_DESCRIPTOR)

    def get_minimum_payout_for_currency(self, currency: str) -> int:
        return self.ACCOUNT_PAYOUT_MINIMUM_BALANCE_PER_PAYOUT_CURRENCY.get(
            currency.lower(), self._DEFAULT_ACCOUNT_PAYOUT_MINIMUM_BALANCE
        )


settings = Settings()
