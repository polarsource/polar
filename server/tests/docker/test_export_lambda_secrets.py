import json
import subprocess

from docker.export_lambda_secrets import export_secrets


def _eval_in_sh(exports: str) -> dict[str, str]:
    """`eval` the exports in a real /bin/sh under `set -eu`, then return the
    resulting environment. Mirrors how run_lambda_worker.sh consumes the
    script output: command substitution -> eval under `set -eu`."""
    script = 'set -eu\neval "$1"\nenv -0\n'
    completed = subprocess.run(
        ["sh", "-c", script, "sh", exports],
        capture_output=True,
        check=False,
    )
    assert completed.returncode == 0, completed.stderr.decode()
    env: dict[str, str] = {}
    for entry in completed.stdout.split(b"\x00"):
        if not entry:
            continue
        key, _, value = entry.decode().partition("=")
        env[key] = value
    return env


class TestExportSecretsNonStringValues:
    def test_numeric_value_is_stringified(self) -> None:
        result = export_secrets(
            json.dumps({"POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_INTERVAL": 60})
        )

        assert result == "export POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_INTERVAL=60"

    def test_bool_value_is_stringified(self) -> None:
        result = export_secrets(json.dumps({"POLAR_FEATURE_ENABLED": True}))

        assert result == "export POLAR_FEATURE_ENABLED=True"


class TestExportSecretsShellEval:
    def test_full_secret_evals_under_set_eu(self) -> None:
        exports = export_secrets(
            json.dumps(
                {
                    "POLAR_DEBUG": "true",
                    "POLAR_POSTGRES_URL": "postgresql://user:pas s'word@host:5432/db",
                    "POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_INTERVAL": 60,
                }
            )
        )

        env = _eval_in_sh(exports)

        assert env["POLAR_DEBUG"] == "true"
        assert env["POLAR_POSTGRES_URL"] == "postgresql://user:pas s'word@host:5432/db"
        assert env["POLAR_GRAFANA_CLOUD_PROMETHEUS_WRITE_INTERVAL"] == "60"
