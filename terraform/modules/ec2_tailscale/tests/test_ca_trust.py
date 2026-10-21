"""Offline control-flow tests; system commands are mocked, not AL2023 trust semantics."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1]
ROOT_FILES = ("Comodo_AAA_Services_root.pem", "emSign_ECC_Root_CA_-_G3.pem")


class CATrustTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.blocklist = self.root / "blocklist"
        self.log = self.root / "commands"
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.env = dict(
            os.environ, PATH=f"{self.bin}:{os.environ['PATH']}", LOG=str(self.log)
        )
        self.script = self.root / "mitigate-ca-trust.sh"
        self.script.write_text(
            (MODULE / "mitigate-ca-trust.sh")
            .read_text()
            .replace(
                "blocklist=/etc/pki/ca-trust/source/blocklist",
                f"blocklist={self.blocklist}",
            )
        )
        self.stub(
            "trust",
            """
printf 'trust %s\n' "$*" >> "$LOG"
case "$1" in
  extract)
    [[ "${FAIL_EXTRACT:-0}" = 0 ]] || exit 1
    if [[ "${EMPTY:-0}" = 1 ]]; then
      : > "${@: -1}"
    else
      printf 'test certificate for %s\n' "$3" > "${@: -1}"
    fi
    ;;
  list)
    [[ "${FAIL_LIST:-0}" = 0 ]] || exit 1
    if [[ "${STILL_TRUSTED:-0}" = 1 ]]; then
      echo '    trust: anchor'
    elif [[ "${EMPTY:-0}" != 1 ]]; then
      echo '    trust: distrusted'
    fi
    ;;
  *) exit 1 ;;
esac
""",
        )
        self.stub(
            "update-ca-trust",
            """
echo "update-ca-trust $*" >> "$LOG"
[[ "${FAIL_UPDATE:-0}" = 0 ]]
""",
        )
        self.stub(
            "systemctl",
            """
echo "systemctl $*" >> "$LOG"
case "$1" in
  is-active) [[ "${ACTIVE:-0}" = 1 ]] ;;
  restart) [[ "${FAIL_RESTART:-0}" = 0 ]] ;;
  *) exit 1 ;;
esac
""",
        )

    def stub(self, name, body):
        path = self.bin / name
        path.write_text("#!/bin/bash\nset -euo pipefail\n" + body)
        path.chmod(0o755)

    def run_helper(self, **env):
        return subprocess.run(
            ["bash", str(self.script)],
            env=dict(self.env, **env),
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )

    def test_new_host_blocks_both_roots_without_starting_daemon(self):
        result = self.run_helper()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            sorted(p.name for p in self.blocklist.iterdir()), sorted(ROOT_FILES)
        )
        for filename in ROOT_FILES:
            self.assertTrue((self.blocklist / filename).read_text())
        self.assertNotIn("systemctl restart", self.log.read_text())

    def test_running_host_restarts_only_after_trust_verification(self):
        result = self.run_helper(ACTIVE="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = self.log.read_text().splitlines()
        self.assertLess(
            lines.index("update-ca-trust extract"),
            next(i for i, s in enumerate(lines) if s.startswith("trust list")),
        )
        self.assertEqual(lines[-1], "systemctl restart tailscaled")

    def test_repeat_run_keeps_existing_blocklists_when_extraction_is_empty(self):
        self.assertEqual(self.run_helper().returncode, 0)
        before = {p.name: p.read_bytes() for p in self.blocklist.iterdir()}
        self.assertEqual(self.run_helper(EMPTY="1").returncode, 0)
        self.assertEqual(
            before, {p.name: p.read_bytes() for p in self.blocklist.iterdir()}
        )
        self.assertEqual(self.run_helper().returncode, 0)
        self.assertEqual(
            before, {p.name: p.read_bytes() for p in self.blocklist.iterdir()}
        )

    def test_upstream_removed_roots_need_no_new_blocklist_files(self):
        result = self.run_helper(EMPTY="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(list(self.blocklist.iterdir()), [])

    def test_failures_abort_before_daemon_restart(self):
        for failure in ("FAIL_EXTRACT", "FAIL_UPDATE", "FAIL_LIST", "STILL_TRUSTED"):
            with self.subTest(failure=failure):
                self.log.write_text("")
                result = self.run_helper(ACTIVE="1", **{failure: "1"})
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("systemctl restart", self.log.read_text())

    def test_restart_failure_is_not_hidden(self):
        self.assertNotEqual(self.run_helper(ACTIVE="1", FAIL_RESTART="1").returncode, 0)

    def test_bootstrap_stops_before_network_when_mitigation_fails(self):
        bootstrap = self.root / "tailscale-init.sh"
        bootstrap.write_text(
            (MODULE / "tailscale-init.sh")
            .read_text()
            .replace(
                "/usr/local/sbin/mitigate-ca-trust", str(self.bin / "mitigate-ca-trust")
            )
        )
        self.stub("mitigate-ca-trust", 'echo mitigate >> "$LOG"; exit 1\n')
        for name in ("curl", "dnf", "aws", "tailscale"):
            self.stub(name, f'echo {name} >> "$LOG"; exit 1\n')
        result = subprocess.run(
            [
                "bash",
                str(bootstrap),
                "test-region",
                "test-secret",
                "test-host",
                "false",
                "",
                "",
            ],
            env=self.env,
            check=False,
            capture_output=True,
            timeout=10,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.log.read_text(), "mitigate\n")

    def test_cloud_init_delivers_helper_and_bootstrap_order_is_safe(self):
        config = (MODULE / "main.tf").read_text()
        self.assertIn(
            'content     = file("${path.module}/mitigate-ca-trust.sh")', config
        )
        self.assertIn('path        = "/usr/local/sbin/mitigate-ca-trust"', config)
        self.assertIn("user_data_replace_on_change = true", config)
        script = (MODULE / "tailscale-init.sh").read_text()
        first = script.index("/usr/local/sbin/mitigate-ca-trust")
        second = script.index("/usr/local/sbin/mitigate-ca-trust", first + 1)
        self.assertLess(first, script.index("curl --fail"))
        self.assertLess(script.index("dnf install"), second)
        self.assertLess(second, script.index("systemctl enable"))
        self.assertLess(second, script.index("aws secretsmanager"))


if __name__ == "__main__":
    unittest.main()
