import json
from pathlib import Path

import pytest

from scripts.merge_test_durations import main, merge_durations


def test_merges_timings_from_every_shard(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    paths = [tmp_path / f"shard-{index}.json" for index in range(4)]
    expected = {}
    for index, path in enumerate(paths):
        durations = {f"tests/test_{index}.py::test_example": index + 0.5}
        path.write_text(json.dumps(durations))
        expected.update(durations)
    output = tmp_path / "merged.json"
    monkeypatch.setattr(
        "sys.argv",
        [
            "merge_test_durations",
            "--expected-shards",
            "4",
            "--output",
            str(output),
            *map(str, paths),
        ],
    )

    main()

    assert json.loads(output.read_text()) == expected


def test_rejects_stale_timings_shared_between_shards(tmp_path: Path) -> None:
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"
    first.write_text(json.dumps({"test_old": 1.0, "test_new": 2.0}))
    second.write_text(json.dumps({"test_old": 0.5}))

    with pytest.raises(ValueError, match="multiple shards: test_old"):
        merge_durations([first, second])


def test_missing_shard_does_not_publish_cache(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    output = tmp_path / "merged.json"
    monkeypatch.setattr(
        "sys.argv",
        [
            "merge_test_durations",
            "--expected-shards",
            "4",
            "--output",
            str(output),
            str(tmp_path / "one-shard.json"),
        ],
    )

    with pytest.raises(SystemExit, match="2"):
        main()

    assert not output.exists()
