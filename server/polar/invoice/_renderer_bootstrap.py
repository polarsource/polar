"""Initialize the PDF forkserver without the worker's instrumentation settings."""

import os
from importlib import import_module
from pathlib import Path

from .renderer import build_renderer_env

renderer_env = build_renderer_env()
os.environ.clear()
os.environ.update(renderer_env)
os.chdir(Path(__file__).resolve().parents[2])

import_module("polar.invoice.render")
import_module("polar.receipt.render")
