from typing import Literal, NotRequired, TypedDict


class Node(TypedDict):
    nodeid: str
    group: str | None
    tinybird: bool
    stock_report_nodeid: str
    location: tuple[str, int | None, str]
    class_chain: list[str]
    test_name: str
    module_path: str


class Report(TypedDict):
    nodeid: str
    when: Literal["setup", "call", "teardown"]
    outcome: Literal["passed", "failed", "skipped"]
    duration: float
    wasxfail: str | None


class ChildResult(TypedDict):
    worker: str
    pid: int
    exit_code: int
    assigned: list[str]
    collected: list[str]
    reports: list[Report]
    phases: dict[str, float]
    seconds: float
    cpu_user_seconds: float
    cpu_system_seconds: float
    peak_rss_native_units: int


class Collection(TypedDict):
    ready: bool
    nodes: list[Node]
    root: str
    seconds: float
    error: NotRequired[str]
    python: NotRequired[str]
    pytest: NotRequired[str]
    phases: NotRequired[dict[str, float]]
    cpu_user_seconds: NotRequired[float]
    cpu_system_seconds: NotRequired[float]
    peak_rss_native_units: NotRequired[int]
    resources: NotRequired[dict[str, object]]
