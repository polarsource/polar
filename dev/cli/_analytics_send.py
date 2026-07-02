import json
import sys
import urllib.request
import uuid
from pathlib import Path

_ID_FILE = Path.home() / ".config" / "polar" / "dev_cli_id"


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


def main() -> None:
    data = json.loads(sys.stdin.read())
    body = json.dumps(
        {
            "event": data["event"],
            "distinct_id": data.get("distinct_id") or _distinct_id(),
            "properties": data["properties"],
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
