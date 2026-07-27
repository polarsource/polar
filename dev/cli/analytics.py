import json
import os
import re
import subprocess
import sys
from pathlib import Path

ANALYTICS_URL = "https://polar-dev-analytics.vercel.app/api/track"
EVENT = "dev_cli_command"
_GROUP_COMMANDS = {"db", "docker"}
_FLAG_NAME = re.compile(r"^--?[A-Za-z][A-Za-z0-9-]{0,39}$")
_REDACTED = "<redacted>"
_TOKENISH = re.compile(r"^[A-Za-z0-9_.\-]+$")
_SECRET_PREFIX = re.compile(
    r"^(polar_|sk_|pk_|rk_|whsec_|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_|glpat-|"
    r"xox[baprs]-|AKIA|ASIA|AIza|ya29\.|eyJ[A-Za-z0-9_-]+\.)"
)


def _looks_like_secret(token: str) -> bool:
    if _SECRET_PREFIX.match(token):
        return True
    if len(token) < 20 or not _TOKENISH.match(token):
        return False
    has_digit = any(character.isdigit() for character in token)
    has_upper = any(character.isupper() for character in token)
    has_lower = any(character.islower() for character in token)
    return has_digit or (has_upper and has_lower)


def _redact(token: str) -> str:
    return _REDACTED if _looks_like_secret(token) else token


def _disabled() -> bool:
    return bool(
        os.environ.get("DEV_CLI_NO_ANALYTICS") or os.environ.get("DO_NOT_TRACK")
    )


def _endpoint() -> str:
    return (os.environ.get("DEV_CLI_ANALYTICS_URL") or ANALYTICS_URL).strip()


def parse_invocation(argv: list[str]) -> tuple[str, list[str], str]:
    args = argv[1:]

    leading: list[str] = []
    for arg in args:
        if arg.startswith("-"):
            break
        leading.append(arg)
        if len(leading) >= 2:
            break

    if not leading:
        command = "<no command>"
    elif len(leading) >= 2 and leading[0] in _GROUP_COMMANDS:
        command = f"{leading[0]} {_redact(leading[1])}"
    else:
        command = _redact(leading[0])

    flag_names = (
        arg.split("=", 1)[0] for arg in args if arg.startswith("-")
    )
    flags = sorted(
        {_redact(name) for name in flag_names if _FLAG_NAME.match(name)}
    )
    invocation = " ".join([command, *flags])
    return command, flags, invocation


def _git_identity() -> tuple[str, str]:
    def _config(key: str) -> str:
        try:
            result = subprocess.run(
                ["git", "config", "--get", key],
                capture_output=True,
                text=True,
                timeout=2,
            )
            return result.stdout.strip() if result.returncode == 0 else ""
        except Exception:
            return ""

    return _config("user.name"), _config("user.email")


def track(argv: list[str]) -> None:
    endpoint = _endpoint()
    if _disabled() or not endpoint:
        return
    command, flags, invocation = parse_invocation(argv)
    git_name, git_email = _git_identity()
    payload = json.dumps(
        {
            "url": endpoint,
            "event": EVENT,
            "distinct_id": git_email or None,
            "properties": {
                "command": command,
                "invocation": invocation,
                "flags": flags,
                "os": sys.platform,
                "git_name": git_name,
                "git_email": git_email,
            },
        }
    )
    try:
        sender = Path(__file__).with_name("_analytics_send.py")
        proc = subprocess.Popen(
            [sys.executable, str(sender)],
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        proc.stdin.write(payload.encode())
        proc.stdin.close()
    except Exception:
        pass
