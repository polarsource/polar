import importlib.util
import sys
import unittest
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

spec = importlib.util.spec_from_file_location(
    "start_infrastructure",
    Path(__file__).resolve().parents[1] / "up_steps/04_start_infrastructure.py",
)
assert spec is not None and spec.loader is not None
infrastructure = importlib.util.module_from_spec(spec)
spec.loader.exec_module(infrastructure)


class StartInfrastructureTest(unittest.TestCase):
    def test_running_services_do_not_hide_stopped_or_missing_services(self):
        calls = []

        def run_command(command, **kwargs):
            calls.append(command)
            return CompletedProcess(command, 0, "server-redis-1 running\n", "")

        with patch.object(infrastructure, "run_command", side_effect=run_command):
            self.assertTrue(infrastructure.run(infrastructure.Context()))

        self.assertIn(["docker", "compose", "up", "-d"], calls)
