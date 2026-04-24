import functools
import os
import tempfile
from datetime import timedelta
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlparse

from annotated_types import Ge
from pydantic import AfterValidator, DirectoryPath, Field, PostgresDsn
from pydantic_ai.models import Model, infer_model, parse_model_id
from pydantic_ai.providers.gateway import gateway_provider
from pydantic_settings import BaseSettings, SettingsConfigDict

from polar.enums import EmailSender, TaxProcessor
from polar.kit.address import Address, CountryAlpha2
from polar.kit.jwk import JWKSFile


class Environment(StrEnum):
    development = "development"
    testing = "testing"  # Used for running tests
    sandbox = "sandbox"
    production = "production"
    test = "test"  # Used for the test environment in Render


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

    # Grafana Cloud Prometheus
    GRAFANA_CLOUD_PROMETHEUS_WRITE_URL: str | None = None
    GRAFANA_CLOUD_PROMETHEUS_WRITE_USERNAME: str | None = None
    GRAFANA_CLOUD_PROMETHEUS_WRITE_PASSWORD: str | None = None
    GRAFANA_CLOUD_PROMETHEUS_WRITE_INTERVAL: Annotated[int, Ge(1)] = 60  # seconds
    GRAFANA_CLOUD_PROMETHEUS_QUERY_URL: str | None = None
    GRAFANA_CLOUD_PROMETHEUS_QUERY_USER: str | None = None
    GRAFANA_CLOUD_PROMETHEUS_QUERY_KEY: str | None = None

    # Slack
    SLACK_BOT_TOKEN: str | None = None
    SLACK_CHANNEL: str | None = None

    # SLO Report
    SLO_REPORT_ENABLED: bool = True

    WEBHOOK_MAX_RETRIES: int = 10
    WEBHOOK_FIFO_GUARD_DELAY_MS: int = 300  # p95 is 236ms
    WEBHOOK_FIFO_GUARD_MAX_AGE: timedelta = timedelta(minutes=1)
    WEBHOOK_EVENT_RETENTION_PERIOD: timedelta = timedelta(days=90)
    WEBHOOK_FAILURE_THRESHOLD: int = 10

    WORKER_DEFAULT_DEBOUNCE_MIN_THRESHOLD: timedelta = timedelta(seconds=15)
    WORKER_DEFAULT_DEBOUNCE_MAX_THRESHOLD: timedelta = timedelta(minutes=15)

    CUSTOMER_METER_UPDATE_DEBOUNCE_MIN_THRESHOLD: timedelta = timedelta(seconds=15)
    CUSTOMER_METER_UPDATE_DEBOUNCE_MAX_THRESHOLD: timedelta = timedelta(minutes=180)

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
    CHECKOUT_LINK_HOST: str | None = None  # e.g., "buy.polar.sh" in production

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

    # OAuth state
    OAUTH_STATE_TTL: timedelta = timedelta(minutes=10)
    OAUTH_STATE_COOKIE_KEY: str = "polar_oauth_state"

    # App Review bypass (for testing login flow during Apple/Google app reviews)
    APP_REVIEW_EMAIL: str | None = None
    APP_REVIEW_OTP_CODE: str | None = None

    # Email verification
    EMAIL_VERIFICATION_TTL_SECONDS: int = 60 * 30  # 30 minutes

    # Checkout
    CHECKOUT_TTL_SECONDS: int = 60 * 60 * 24  # 24 hours
    IP_GEOLOCATION_DATABASE_DIRECTORY_PATH: DirectoryPath = Path(__file__).parent.parent
    IP_GEOLOCATION_DATABASE_NAME: str = "ip-geolocation.mmdb"

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
    RESEND_WEBHOOK_SECRET: str = ""
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
    DISCORD_PROXY_URL: str = ""

    # Google
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Apple
    APPLE_CLIENT_ID: str = ""
    APPLE_TEAM_ID: str = ""
    APPLE_KEY_ID: str = ""
    APPLE_KEY_VALUE: str = ""

    # Pydantic AI Gateway
    PYDANTIC_AI_GATEWAY_API_KEY: str = "DummyKey"
    PYDANTIC_AI_GATEWAY_MODEL: str = "openai:gpt-5.2-2025-12-11"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    # Stripe webhook secrets
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_CONNECT_WEBHOOK_SECRET: str = ""
    STRIPE_STATEMENT_DESCRIPTOR: str = "POLAR"

    # Numeral
    NUMERAL_API_KEY: str | None = None

    # Sentry
    SENTRY_DSN: str | None = None

    # Discord
    FAVICON_URL: str = "https://raw.githubusercontent.com/polarsource/polar/2648cf7472b5128704a097cd1eb3ae5f1dd847e5/docs/docs/assets/favicon.png"
    THUMBNAIL_URL: str = "https://raw.githubusercontent.com/polarsource/polar/4fd899222e200ca70982f437039f549b7a822ecc/clients/apps/web/public/email-logo-dark.png"

    # Posthog
    POSTHOG_PROJECT_API_KEY: str = ""

    # Loops
    LOOPS_API_KEY: str | None = None

    # Tinybird
    TINYBIRD_API_URL: str = "http://localhost:7181"
    TINYBIRD_API_TOKEN: str | None = None
    TINYBIRD_READ_TOKEN: str | None = None
    TINYBIRD_CLICKHOUSE_URL: str = "http://localhost:7182"
    TINYBIRD_CLICKHOUSE_USERNAME: str = "default"
    TINYBIRD_CLICKHOUSE_TOKEN: str | None = None
    TINYBIRD_WORKSPACE: str | None = None
    TINYBIRD_BRANCH: str | None = None
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
        "proton.me",
        "zoho.com",
        "gmx.com",
        "yandex.com",
        "msn.com",
        "live.com",
        "qq.com",
    }

    # Memory Profiling
    MEMORY_PROFILE_ENABLED: bool = False
    MEMORY_PROFILE_INTERVAL: int = 300  # seconds between snapshots
    MEMORY_PROFILE_S3_BUCKET_NAME: str | None = None

    # Logfire
    LOGFIRE_TOKEN: str | None = None
    LOGFIRE_IGNORED_ACTORS: set[str] = {
        "organization_access_token.record_usage",
        "personal_access_token.record_usage",
    }
    # S3 logs storage
    S3_LOGS_BUCKET_NAME: str | None = None

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
    S3_FILES_PRESIGN_TTL: int = 3600  # 60 minutes
    S3_FILES_DOWNLOAD_SECRET: str = "supersecret"
    S3_FILES_DOWNLOAD_SALT: str = "saltysalty"
    # Override to http://127.0.0.1:9000 in .env during development
    S3_ENDPOINT_URL: str | None = None

    MINIO_USER: str = "polar"
    MINIO_PWD: str = "polarpolar"

    # Chargeback Stop
    CHARGEBACK_STOP_WEBHOOK_SECRET: str = ""

    # Polar's usage of Polar
    POLAR_ACCESS_TOKEN: str = ""
    POLAR_WEBHOOK_SECRET: str = ""
    POLAR_ORGANIZATION_ID: str = ""
    POLAR_FREE_PRODUCT_ID: str = ""
    POLAR_API_URL: str = "https://api.polar.sh"

    @property
    def POLAR_SELF_ENABLED(self) -> bool:
        return all(
            [
                self.POLAR_ACCESS_TOKEN,
                self.POLAR_ORGANIZATION_ID,
                self.POLAR_FREE_PRODUCT_ID,
            ]
        )

    # Customer portal URL overrides per organization
    CUSTOMER_PORTAL_URL_OVERRIDES: dict[str, str] = {}

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
    INVOICES_ADDITIONAL_INFO: str | None = (
        "[support@polar.sh](mailto:support@polar.sh)\nVAT: EU0000000"
    )
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
    # Minimum payout amounts per country (in USD cents), based on Stripe's per-country
    # minimums converted from local currency to USD (ceiling).
    # Source: https://docs.stripe.com/global-payouts/send-money
    # FX rates are approximate as of 2026-04-24. Refresh periodically.
    # TODO: Refresh FX rates periodically based on https://docs.stripe.com/global-payouts/send-money
    ACCOUNT_PAYOUT_MINIMUM_BALANCE_PER_PAYOUT_COUNTRY: dict[str, int] = {
        "AE": 137,   # United Arab Emirates: 5 AED ≈ $1.37
        "AG": 2,     # Antigua and Barbuda: 0.04 XCD ≈ $0.01
        "AL": 3175,  # Albania: 3000 ALL ≈ $31.75
        "AM": 3025,  # Armenia: 12100 AMD ≈ $30.25
        "AT": 2,     # Austria: 0.01 EUR ≈ $0.01
        "AU": 1,     # Australia: 0.01 AUD ≈ $0.01
        "BA": 2778,  # Bosnia and Herzegovina: 50 BAM ≈ $27.78
        "BE": 2,     # Belgium: 0.01 EUR ≈ $0.01
        "BG": 2,     # Bulgaria: 0.01 EUR ≈ $0.01
        "BH": 2,     # Bahrain: 0.005 BHD ≈ $0.01
        "BJ": 1,     # Benin: 1 XOF ≈ $0.00
        "BN": 75,    # Brunei: 1 BND ≈ $0.75
        "BS": 2500,  # Bahamas: 25 BSD ≈ $25.00
        "BT": 3013,  # Bhutan: 2500 BTN ≈ $30.13
        "BW": 8,     # Botswana: 1 BWP ≈ $0.07
        "CA": 1,     # Canada: 0.01 CAD ≈ $0.01
        "CH": 2,     # Switzerland: 0.01 EUR ≈ $0.01
        "CI": 1,     # Côte d'Ivoire: 1 XOF ≈ $0.00
        "CR": 2,     # Costa Rica: 7 CRC ≈ $0.01
        "CY": 2,     # Cyprus: 0.01 EUR ≈ $0.01
        "CZ": 2,     # Czech Republic: 0.01 EUR ≈ $0.01
        "DE": 2,     # Germany: 0.01 EUR ≈ $0.01
        "DK": 1,     # Denmark: 0.01 DKK ≈ $0.00
        "DZ": 1,     # Algeria: 1 DZD ≈ $0.01
        "EC": 100,   # Ecuador: 1 USD = $1.00
        "EE": 2,     # Estonia: 0.01 EUR ≈ $0.01
        "ES": 2,     # Spain: 0.01 EUR ≈ $0.01
        "ET": 2,     # Ethiopia: 1 ETB ≈ $0.02
        "FI": 2,     # Finland: 0.01 EUR ≈ $0.01
        "FR": 2,     # France: 0.01 EUR ≈ $0.01
        "GB": 2,     # United Kingdom: 0.01 GBP ≈ $0.01
        "GM": 2815,  # Gambia: 1900 GMD ≈ $28.15
        "GR": 2,     # Greece: 0.01 EUR ≈ $0.01
        "GT": 13,    # Guatemala: 1 GTQ ≈ $0.13
        "GY": 3015,  # Guyana: 6300 GYD ≈ $30.15
        "HK": 256,   # Hong Kong: 20 HKD ≈ $2.56
        "HR": 2,     # Croatia: 0.01 EUR ≈ $0.01
        "HU": 1,     # Hungary: 0.01 HUF ≈ $0.00
        "ID": 1,     # Indonesia: 0.01 IDR ≈ $0.00
        "IE": 2,     # Ireland: 0.01 EUR ≈ $0.01
        "IL": 1,     # Israel: 0.01 ILS ≈ $0.00
        "IS": 2,     # Iceland: 0.01 EUR ≈ $0.01
        "IT": 2,     # Italy: 0.01 EUR ≈ $0.01
        "JM": 0,     # Jamaica: 0 JMD = $0.00
        "JO": 2,     # Jordan: 0.01 JOD ≈ $0.01
        "KE": 14,    # Kenya: 20 KES ≈ $0.14
        "KW": 323,   # Kuwait: 1 KWD ≈ $3.23
        "LC": 2,     # Saint Lucia: 0.04 XCD ≈ $0.01
        "LI": 2,     # Liechtenstein: 0.01 EUR ≈ $0.01
        "LK": 1,     # Sri Lanka: 1 LKR ≈ $0.00
        "LT": 2,     # Lithuania: 0.01 EUR ≈ $0.01
        "LU": 2,     # Luxembourg: 0.01 EUR ≈ $0.01
        "LV": 2,     # Latvia: 0.01 EUR ≈ $0.01
        "MA": 1,     # Morocco: 0.01 MAD ≈ $0.00
        "MD": 2809,  # Moldova: 500 MDL ≈ $28.09
        "MG": 2940,  # Madagascar: 132300 MGA ≈ $29.40
        "MK": 2655,  # North Macedonia: 1500 MKD ≈ $26.55
        "MN": 3044,  # Mongolia: 105000 MNT ≈ $30.44
        "MT": 2,     # Malta: 0.01 EUR ≈ $0.01
        "MU": 1,     # Mauritius: 0.01 MUR ≈ $0.00
        "MX": 1,     # Mexico: 0.01 MXN ≈ $0.00
        "MY": 2830,  # Malaysia: 133 MYR ≈ $28.30
        "MZ": 2500,  # Mozambique: 1600 MZN ≈ $25.00
        "NA": 2660,  # Namibia: 500 NAD ≈ $26.60
        "NL": 2,     # Netherlands: 0.01 EUR ≈ $0.01
        "NO": 1,     # Norway: 0.01 NOK ≈ $0.00
        "NZ": 1,     # New Zealand: 0.01 NZD ≈ $0.01
        "OM": 2,     # Oman: 0.005 OMR ≈ $0.01
        "PA": 5000,  # Panama: 50 USD = $50.00
        "PE": 2,     # Peru: 0.05 PEN ≈ $0.01
        "PH": 1,     # Philippines: 0.01 PHP ≈ $0.00
        "PK": 2,     # Pakistan: 4 PKR ≈ $0.01
        "PL": 1,     # Poland: 0.01 PLN ≈ $0.00
        "PT": 2,     # Portugal: 0.01 EUR ≈ $0.01
        "QA": 28,    # Qatar: 1 QAR ≈ $0.27
        "RO": 1,     # Romania: 0.01 RON ≈ $0.00
        "RS": 2778,  # Serbia: 3000 RSD ≈ $27.78
        "RW": 8,     # Rwanda: 100 RWF ≈ $0.08
        "SE": 1,     # Sweden: 0.01 SEK ≈ $0.00
        "SG": 1,     # Singapore: 0.01 SGD ≈ $0.01
        "SI": 2,     # Slovenia: 0.01 EUR ≈ $0.01
        "SK": 2,     # Slovakia: 0.01 EUR ≈ $0.01
        "SN": 1,     # Senegal: 1 XOF ≈ $0.00
        "SV": 3000,  # El Salvador: 30 USD = $30.00
        "TH": 1676,  # Thailand: 600 THB ≈ $16.76
        "TN": 1,     # Tunisia: 0.001 TND ≈ $0.00
        "TR": 17,    # Turkey: 5 TRY ≈ $0.16
        "TT": 2,     # Trinidad and Tobago: 0.1 TTD ≈ $0.01
        "TW": 2540,  # Taiwan: 800 TWD ≈ $25.40
        "TZ": 2,     # Tanzania: 35 TZS ≈ $0.01
        "US": 1,     # United States: 0.01 USD = $0.01
        "UZ": 2767,  # Uzbekistan: 343000 UZS ≈ $27.67
        "VN": 333,   # Vietnam: 81125 VND ≈ $3.33
        "ZA": 532,   # South Africa: 100 ZAR ≈ $5.32
    }
    PLATFORM_FEE_BASIS_POINTS: int = 400
    PLATFORM_FEE_FIXED: int = 40

    ORGANIZATION_BLOCKED_WORDS: list[str] = [
        "porn",
        "porno",
        "pornography",
        "sex",
        "sexual",
        "sexy",
        "nsfw",
        "xxx",
        "hentai",
        "erotic",
        "erotica",
        "fetish",
        "nude",
        "nudes",
        "nudity",
        "onlyfans",
        "camgirl",
        "escort",
    ]

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

    # Dunning Configuration
    DUNNING_RETRY_INTERVALS: list[timedelta] = [
        timedelta(days=2),  # First retry after 2 days
        timedelta(days=5),  # Second retry after 7 days (2 + 5)
        timedelta(days=7),  # Third retry after 14 days (2 + 5 + 7)
        timedelta(days=7),  # Fourth retry after 21 days (2 + 5 + 7 + 7)
    ]
    CUSTOMER_RETRY_MAX_ATTEMPTS: int = 5

    TAX_PROCESSORS: list[TaxProcessor] = [TaxProcessor.stripe]
    TAX_RECORD_PROCESSOR: TaxProcessor = TaxProcessor.stripe

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

    @property
    def frontend_hostname(self) -> str:
        return urlparse(self.FRONTEND_BASE_URL).hostname or "polar.sh"

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

    def get_minimum_payout_for_account(self, currency: str, country: str) -> int:
        currency_min = self.get_minimum_payout_for_currency(currency)
        country_min = self.ACCOUNT_PAYOUT_MINIMUM_BALANCE_PER_PAYOUT_COUNTRY.get(
            country.upper(), 0
        )
        return max(currency_min, country_min)

    def get_pydantic_gateway_model(
        self, model: str | None = None
    ) -> tuple[Model, str, str]:
        model = model or settings.PYDANTIC_AI_GATEWAY_MODEL
        model_provider, model_name = parse_model_id(model)
        assert model_provider is not None
        return (
            infer_model(
                model,
                provider_factory=functools.partial(
                    gateway_provider, api_key=self.PYDANTIC_AI_GATEWAY_API_KEY
                ),
            ),
            model_provider,
            model_name,
        )


settings = Settings()
