from pathlib import Path

import pytest

from scripts.pytest_shards import main, split_files


@pytest.mark.parametrize("cached", [False, True])
def test_each_file_runs_once_in_a_deterministic_shard(
    tmp_path: Path, cached: bool
) -> None:
    files = [tmp_path / f"test_{index}.py" for index in range(12)]
    for index, file in enumerate(files):
        file.write_text("x" * (index + 1))
    durations = (
        {f"{file.as_posix()}::test_example": 1.0 for file in files[:-1]}
        if cached
        else {}
    )

    groups = split_files(files, durations, 3)

    assert all(groups)
    assert sorted(file for group in groups for file in group) == sorted(files)
    assert groups == split_files(list(reversed(files)), durations, 3)


def test_balances_files_by_recorded_test_duration(tmp_path: Path) -> None:
    files = [tmp_path / f"test_{index}.py" for index in range(4)]
    for file in files:
        file.touch()
    durations = {
        f"{file.as_posix()}::test_example": duration
        for file, duration in zip(files, [8.0, 7.0, 6.0, 5.0], strict=True)
    }

    groups = split_files(files, durations, 2)

    assert {frozenset(group) for group in groups} == {
        frozenset([files[0], files[3]]),
        frozenset([files[1], files[2]]),
    }


def test_cli_discovers_uncached_files_without_importing_them(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.chdir(tmp_path)
    tests = tmp_path / "tests"
    tests.mkdir()
    for name in ("test_new.py", "new_test.py", "helper.py"):
        (tests / name).write_text('raise RuntimeError("must not import tests")')

    selected = []
    for shard in ("1", "2"):
        monkeypatch.setattr(
            "sys.argv", ["pytest_shards", "--shards", "2", "--shard", shard]
        )
        main()
        selected.extend(capsys.readouterr().out.splitlines())

    assert sorted(selected) == ["tests/new_test.py", "tests/test_new.py"]
