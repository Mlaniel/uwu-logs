"""
Shared report cache used by both Z_SERVER and api_v2.

Exists to break the circular import: api_v2 previously did a deferred
`from Z_SERVER import load_report` inside a function body to avoid the
import cycle (Z_SERVER → api_v2_bp → api_v2 → Z_SERVER).  Now both
modules import from here instead.

Z_SERVER.load_report wraps open_report with rate-limiting and access
logging (request-context concerns that belong there).  api_v2._load_report
calls open_report directly — no rate-limiting, same cache.
"""

from datetime import datetime

import h_cleaner
import logs_main

OPENED_LOGS: dict[str, logs_main.THE_LOGS] = {}
CLEANER = h_cleaner.MemoryCleaner(OPENED_LOGS)


def open_report(report_id: str) -> logs_main.THE_LOGS:
    now = datetime.now()
    if report_id in OPENED_LOGS:
        report = OPENED_LOGS[report_id]
        report.last_access = now
        return report
    CLEANER.start()
    report = logs_main.THE_LOGS(report_id)
    OPENED_LOGS[report_id] = report
    report.last_access = now
    return report
