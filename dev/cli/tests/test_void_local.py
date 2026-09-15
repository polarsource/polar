import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch

import typer
from typer.testing import CliRunner

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import void_local


class VoidSetupTest(unittest.TestCase):
    def test_setup_saves_shared_configuration_without_launching_worker(self):
        calls = []
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env.void"

            def run_command(command, **kwargs):
                calls.append(command)
                if "void_seed" in command:
                    env_file.write_text("export VOID_TOKEN='local-token'\n")
                    env_file.chmod(0o600)
                return CompletedProcess(command, 0)

            with (
                patch.object(void_local, "ENV_FILE", env_file),
                patch.object(void_local, "run_command", side_effect=run_command),
                patch.object(
                    void_local,
                    "ports",
                    return_value={
                        "TINYBIRD_PORT": "7181",
                        "POLAR_VOID_TEMPORAL_PORT": "7233",
                        "POLAR_VOID_TEMPORAL_UI_PORT": "8233",
                    },
                ),
                patch.object(void_local.urllib.request, "urlopen") as urlopen,
            ):
                urlopen.return_value.__enter__.return_value.read.return_value = (
                    '{"admin_token":"tinybird-token"}'
                )
                self.assertTrue(void_local.setup())
                values = void_local.environment()

            self.assertEqual(values["VOID_TOKEN"], "local-token")
            self.assertEqual(values["POLAR_VOID_TINYBIRD_API_TOKEN"], "tinybird-token")
            self.assertEqual(
                values["POLAR_VOID_TINYBIRD_API_URL"], "http://localhost:7181"
            )
            self.assertEqual(values["POLAR_VOID_TEMPORAL_ADDRESS"], "localhost:7233")
            self.assertEqual(env_file.stat().st_mode & 0o777, 0o600)
        self.assertFalse(any("void_worker" in command for command in calls))
        self.assertFalse(any(command[0] == "docker" for command in calls))
        self.assertLess(
            next(i for i, command in enumerate(calls) if "void_tb_deploy" in command),
            next(i for i, command in enumerate(calls) if "void_seed" in command),
        )

    def test_infrastructure_failure_is_reported(self):
        with patch.object(
            void_local, "run_command", return_value=CompletedProcess([], 1)
        ) as command:
            self.assertFalse(void_local.start_infrastructure())
        self.assertEqual(command.call_count, 1)


class VoidCommandTest(unittest.TestCase):
    def test_worker_receives_saved_configuration(self):
        spec = importlib.util.spec_from_file_location(
            "void_command", Path(__file__).resolve().parents[1] / "commands/void.py"
        )
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        app = typer.Typer()
        module.register(app, lambda: True)
        with (
            patch.object(module, "ENV_FILE") as env_file,
            patch.object(
                module,
                "environment",
                return_value={"POLAR_VOID_TEMPORAL_ADDRESS": "localhost:7233"},
            ),
            patch.object(module, "start_infrastructure", return_value=True),
            patch.object(module.os, "chdir"),
            patch.object(module.os, "execvp") as execute,
            patch.dict(os.environ),
        ):
            env_file.exists.return_value = True
            result = CliRunner().invoke(app, [])
            self.assertEqual(result.exit_code, 0, result.output)
            self.assertEqual(
                os.environ["POLAR_VOID_TEMPORAL_ADDRESS"], "localhost:7233"
            )
            execute.assert_called_once_with("uv", ["uv", "run", "task", "void_worker"])
