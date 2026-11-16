import os

import pytest

from scripts.pytest_bytecode import synchronize_cache

pytest_plugins = ["pytester"]


class TestPytestBytecode:
    def test_restores_rewritten_assertions_without_recompiling(
        self, pytester: pytest.Pytester, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "1")
        source = pytester.makepyfile("def test_value(): assert 1 == 2")
        cache = pytester.path / "bytecode"
        pytester.runpytest_subprocess("-q").assert_outcomes(failed=1)
        assert synchronize_cache(pytester.path, cache, restore=False) == 1

        stat = source.stat()
        os.utime(source, ns=(stat.st_atime_ns, stat.st_mtime_ns + 2_000_000_000))
        pytester.makeconftest(
            """
from _pytest.assertion import rewrite


def pytest_configure():
    def unexpected_rewrite(path, config):
        raise AssertionError("Unexpected assertion recompilation")

    rewrite._rewrite_test = unexpected_rewrite
"""
        )
        assert synchronize_cache(pytester.path, cache, restore=True) == 1
        result = pytester.runpytest_subprocess("-q")
        result.assert_outcomes(failed=1)
        result.stdout.fnmatch_lines(["*assert 1 == 2*"])

    def test_changed_source_invalidates_cache(
        self, pytester: pytest.Pytester, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "1")
        source = pytester.makepyfile("def test_value(): assert 1 == 1")
        cache = pytester.path / "bytecode"
        pytester.runpytest_subprocess("-q").assert_outcomes(passed=1)
        assert synchronize_cache(pytester.path, cache, restore=False) == 1

        stat = source.stat()
        source.write_text("def test_value(): assert 1 == 2")
        os.utime(source, ns=(stat.st_atime_ns, stat.st_mtime_ns))
        assert source.stat().st_size == stat.st_size
        assert synchronize_cache(pytester.path, cache, restore=True) == 0
        result = pytester.runpytest_subprocess("-q")
        result.assert_outcomes(failed=1)
        result.stdout.fnmatch_lines(["*assert 1 == 2*"])
