import cProfile
import json
import os
import resource
import sys
import time
from collections import Counter
from contextlib import contextmanager
from pathlib import Path

import anyio.pytest_plugin as anyio_plugin
import freezegun
import pytest

freezegun.configure(extend_ignore_list=['ci_runtime_profile'])
started = time.perf_counter()
cpu_started = time.process_time()
phases = {}
outcomes = Counter()
slow_tests = []
fixture_counts = Counter()
runner_count = 0
original_get_runner = anyio_plugin.get_runner
profile = cProfile.Profile()
profile.enable()


@contextmanager
def counted_get_runner(*args, **kwargs):
    global runner_count
    if anyio_plugin._current_runner is None:
        runner_count += 1
    with original_get_runner(*args, **kwargs) as runner:
        yield runner


anyio_plugin.get_runner = counted_get_runner


def output_path(suffix):
    worker = os.environ.get('PYTEST_XDIST_WORKER', 'controller')
    path = Path(os.environ['CI_PROFILE_OUTPUT']) / f'{worker}.{suffix}'
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def pytest_sessionstart(session):
    phases['configuration'] = time.perf_counter() - started
    phases['collection_started'] = time.perf_counter()


def pytest_collection_finish(session):
    profile.disable()
    profile.dump_stats(str(output_path('startup.prof')))
    phases['collection'] = time.perf_counter() - phases.pop('collection_started')
    phases['execution_started'] = time.perf_counter()


@pytest.hookimpl(wrapper=True)
def pytest_fixture_setup(fixturedef, request):
    fixture_counts[fixturedef.argname] += 1
    return (yield)


def pytest_runtest_logreport(report):
    if report.when == 'call' or report.failed:
        outcomes[report.outcome] += 1
    if report.duration >= 0.2:
        slow_tests.append({'node': report.nodeid, 'phase': report.when, 'seconds': report.duration, 'elapsed': time.perf_counter() - started})


def pytest_sessionfinish(session, exitstatus):
    profile.disable()
    phases['execution'] = time.perf_counter() - phases.pop('execution_started', time.perf_counter())
    output_path('json').write_text(json.dumps({
        'worker': os.environ.get('PYTEST_XDIST_WORKER', 'controller'),
        'phases': phases,
        'wall_seconds': time.perf_counter() - started,
        'cpu_seconds': time.process_time() - cpu_started,
        'peak_rss_kb': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        'outcomes': dict(outcomes),
        'slow_tests': slow_tests,
        'fixture_counts': dict(fixture_counts),
        'runner_count': runner_count,
        'app_loaded': 'polar.app' in sys.modules,
        'exitstatus': int(exitstatus),
    }, indent=2))
