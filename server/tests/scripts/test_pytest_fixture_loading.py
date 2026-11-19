from pathlib import Path

import pytest

pytest_plugins = ["pytester"]


@pytest.mark.parametrize("arguments", [[], ["-n", "0"], ["-n", "2"]])
def test_fixture_loading_matches_execution_mode(
    pytester: pytest.Pytester,
    monkeypatch: pytest.MonkeyPatch,
    arguments: list[str],
) -> None:
    for name in (
        "PYTEST_XDIST_WORKER",
        "PYTEST_XDIST_WORKER_COUNT",
        "POLAR_TEST_FILES",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("POLAR_TEST_XDIST", "true")
    monkeypatch.setenv("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "1")
    imports = pytester.path / "imports"
    imports.mkdir()
    monkeypatch.setenv("FIXTURE_PROBE_DIR", str(imports))
    tests = pytester.path / "tests"
    fixtures = tests / "fixtures"
    fixtures.mkdir(parents=True)
    (tests / "__init__.py").touch()
    (tests / "tinybird-files.txt").touch()
    (tests / "conftest.py").write_text(
        (Path(__file__).parents[1] / "conftest.py").read_text()
    )
    (fixtures / "__init__.py").write_text(
        """
import os
from pathlib import Path
import pytest

(Path(os.environ['FIXTURE_PROBE_DIR']) / os.environ.get('PYTEST_XDIST_WORKER', 'controller')).touch()

@pytest.fixture(autouse=True)
def activate_fixture(monkeypatch):
    monkeypatch.setenv('FIXTURE_ACTIVE', 'true')

@pytest.fixture
def example():
    return 42
"""
    )
    (fixtures / "auth.py").write_text("def pytest_generate_tests(metafunc): pass\n")
    (fixtures / "base.py").write_text(
        "def pytest_generate_tests_api_version(metafunc): pass\n"
    )
    (tests / "test_example.py").write_text(
        "def test_example(example): assert example == 42\n"
    )
    pytester.makepyfile(
        test_outside="import os\ndef test_outside(): assert 'FIXTURE_ACTIVE' not in os.environ\n"
    )

    result = pytester.runpytest_subprocess("-p", "xdist.plugin", *arguments)

    result.assert_outcomes(passed=2)
    assert {path.name for path in imports.iterdir()} == (
        {"gw0", "gw1"} if arguments == ["-n", "2"] else {"controller"}
    )
