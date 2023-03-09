import os
from enum import Enum

from pydantic import AnyHttpUrl, BaseSettings, PostgresDsn, validator


class Environment(Enum):
    development = "development"
    testing = "testing"
    staging = "staging"
    production = "production"


class Settings(BaseSettings):
    ENV: Environment = Environment.development
    DEBUG: bool = False
    LOG_LEVEL: str = "DEBUG"
    TESTING: bool = False

    SECRET: str = "super secret jwt secret"

    # JSON list of accepted CORS origins
    CORS_ORIGINS: list[AnyHttpUrl] = []

    # URL to frontend app.
    # Update to ngrok domain or similar in case you want
    # working Github badges in development.
    FRONTEND_BASE_URL: str = "http://127.0.0.1:3000"

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

    # Celery
    CELERY_BROKER_URL: str = "redis://127.0.0.1:6379"
    CELERY_BACKEND_URL: str = "redis://127.0.0.1:6379"
    # Once True (testing) all Celery tasks are run synchronously
    CELERY_TASK_ALWAYS_EAGER: bool = False

    # Github App
    GITHUB_APP_IDENTIFIER: str = ""
    GITHUB_APP_WEBHOOK_SECRET: str = ""
    GITHUB_APP_PRIVATE_KEY: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URL: str = "http://127.0.0.1:3000/github/session"

    # Application behaviours

    GITHUB_BADGE_EMBED: bool = False

    class Config:
        env_prefix = "polar_"
        env_file_encoding = "utf-8"
        case_sensitive = False

    @validator("GITHUB_APP_PRIVATE_KEY", pre=True)
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

    @property
    def postgres_dsn(self) -> PostgresDsn:
        dsn = self.__dict__.get("postgres_dsn")
        if dsn is None:
            dsn = self.build_postgres_dsn()
            self.__dict__["postgres_dsn"] = dsn
        return dsn

    def build_postgres_dsn(self) -> PostgresDsn:
        uri = PostgresDsn.build(
            scheme=self.POSTGRES_SCHEME,
            user=self.POSTGRES_USER,
            password=self.POSTGRES_PWD,
            host=self.POSTGRES_HOST,
            port=str(self.POSTGRES_PORT),
            path=f"/{self.POSTGRES_DATABASE}",
        )
        return PostgresDsn(uri, scheme=self.POSTGRES_SCHEME)  # type: ignore

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


env = Environment(os.getenv("POLAR_ENV", Environment.development))
env_file = ".env"
if env == Environment.testing:
    env_file = ".env.testing"

settings = Settings(_env_file=env_file, ENV=env)  # type: ignore
settings = Settings(_env_file=env_file, ENV=env)  # type: ignore
