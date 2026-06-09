import os

POLAR_SERVER = os.environ.get("POLAR_SERVER", "production")
POLAR_SERVER_URL = os.environ.get("POLAR_SERVER_URL")

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./sidecar.db")
POLAR_ACCESS_TOKEN = os.environ.get("POLAR_ACCESS_TOKEN")
FLUSH_INTERVAL_SECONDS = float(os.environ.get("FLUSH_INTERVAL_SECONDS", "5"))
FLUSH_BATCH_SIZE = int(os.environ.get("FLUSH_BATCH_SIZE", "100"))

SERVERS = {
    "production": "https://api.polar.sh",
    "sandbox": "https://sandbox-api.polar.sh",
}


def get_base_url() -> str:
    if POLAR_SERVER_URL is not None:
        return POLAR_SERVER_URL.rstrip("/")
    return SERVERS[POLAR_SERVER]
