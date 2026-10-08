from pydantic import Field, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(BaseSettings):
    redis_url: RedisDsn | None = Field(default=None, validation_alias="REDIS_URL")

    model_config = SettingsConfigDict(env_file=".env", env_prefix="POLAR_OUTPOST_")


def get_environment() -> Environment:
    return Environment()
