import json
import subprocess
import sys
import urllib.request
import uuid
from pathlib import Path

_CONFIG_DIR = Path.home() / ".config" / "polar"
_ID_FILE = _CONFIG_DIR / "dev_cli_id"
_GITHUB_USER_FILE = _CONFIG_DIR / "dev_cli_github_user"


def _distinct_id() -> str:
    try:
        existing = _ID_FILE.read_text().strip() if _ID_FILE.exists() else ""
        if existing:
            return existing
        _ID_FILE.parent.mkdir(parents=True, exist_ok=True)
        new_id = uuid.uuid4().hex
        _ID_FILE.write_text(new_id + "\n")
        return new_id
    except Exception:
        return uuid.uuid4().hex


def _github_user() -> str:
    try:
        cached = _GITHUB_USER_FILE.read_text().strip()
        if cached:
            return cached
    except Exception:
        pass

    try:
        result = subprocess.run(
            ["gh", "api", "user", "--jq", ".login"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception:
        return ""
    login = result.stdout.strip() if result.returncode == 0 else ""
    if login:
        try:
            _GITHUB_USER_FILE.parent.mkdir(parents=True, exist_ok=True)
            _GITHUB_USER_FILE.write_text(login + "\n")
        except Exception:
            pass
    return login


def main() -> None:
    data = json.loads(sys.stdin.read())
    github_user = _github_user()
    body = json.dumps(
        {
            "event": data["event"],
            "distinct_id": github_user or _distinct_id(),
            "properties": {**data["properties"], "github_user": github_user},
        }
    ).encode()
    request = urllib.request.Request(
        data["url"],
        data=body,
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(request, timeout=5).read()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
