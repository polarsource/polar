"""Tinybird Local limits each workspace to one ClickHouse push every 4 seconds."""

import importlib.machinery
import importlib.util

ORIGINAL = "/app/local/config/hfi_config_original.pyc"


def conf():
    loader = importlib.machinery.SourcelessFileLoader("hfi_config_original", ORIGINAL)
    spec = importlib.util.spec_from_loader("hfi_config_original", loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    config = module.conf()
    config["ch_ingestion_tokens_per_second_default"] = 1000
    config["ch_ingestion_burst_size"] = 1000
    return config
