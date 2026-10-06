from enum import StrEnum
from typing import Self

from pydantic import RedisDsn, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class StorageType(StrEnum):
    memory = "memory"
    redis = "redis"


class Environment(BaseSettings):
    storage: StorageType = StorageType.memory
    redis_dsn: RedisDsn | None = None

    model_config = SettingsConfigDict(env_file=".env", env_prefix="POLAR_OUTPOST_")

    @model_validator(mode="after")
    def validate_storage(self) -> Self:
        if self.storage == StorageType.redis and self.redis_dsn is None:
            message = "Redis storage requires POLAR_OUTPOST_REDIS_DSN"
            raise ValueError(message)
        return self


def get_environment() -> Environment:
    return Environment()
