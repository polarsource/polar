import os
import tempfile

_db_dir = tempfile.mkdtemp(prefix="sidecar-test-")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_db_dir}/test.db"
os.environ.pop("POLAR_ACCESS_TOKEN", None)
