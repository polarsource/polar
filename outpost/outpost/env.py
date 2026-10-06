from typing import Annotated

from pydantic import Field, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(BaseSettings):
    redis_dsn: Annotated[RedisDsn, Field(default="redis://localhost:6379/0")]

    model_config = SettingsConfigDict(env_file=".env", env_prefix="POLAR_OUTPOST_")


def get_environment() -> Environment:
    return Environment()
