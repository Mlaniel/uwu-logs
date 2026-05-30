from collections import defaultdict
from time import perf_counter

from c_path import Directories, FileNames
from c_server_phase import get_server_phase
from h_debug import Loggers, get_ms_str
from h_other import get_report_name_info
import logs_top

LOGGER = Loggers.reports

# Table mode used for the speedrun DB per raid (determines table name)
SPEEDRUN_RAID_MODE: dict[str, str] = {
    "Icecrown Citadel":      "25H",
    "Trial of the Crusader": "25H",
    "Ulduar":                "25H",
    "Naxxramas":             "25N",
    "The Ruby Sanctum":      "25N",
}


def _make_speedrun(report_name: str) -> dict:
    info = get_report_name_info(report_name)
    server = info["server"]
    # Strip server suffix — Vue reconstructs the full link as "{report_id}--{server}"
    report_id = report_name.rsplit("--", 1)[0]

    phase = get_server_phase(server)

    # Required (boss_name, difficulty) pairs per raid
    raid_required: dict[str, set] = defaultdict(set)
    for encounter in phase.FOR_POINTS:
        if encounter.raid:
            raid_required[encounter.raid].add((encounter.name, encounter.mode))

    if not raid_required:
        return {}

    report = logs_top.Top(report_name)

    # Collect kill segments that belong to a FOR_POINTS encounter
    kills_by_raid: dict[str, list] = defaultdict(list)
    for boss_name, segment in report.gen_kill_segments():
        for raid, required in raid_required.items():
            if (boss_name, segment.difficulty) in required:
                kills_by_raid[raid].append(segment)
                break

    result = {}
    for raid, kills in kills_by_raid.items():
        required = raid_required[raid]
        killed_set = {(s.encounter_name, s.difficulty) for s in kills}
        if not required.issubset(killed_set):
            continue  # incomplete clear

        first_start = min(s.start for s in kills)
        last_end   = max(s.end   for s in kills)
        total_length  = report.get_slice_duration(first_start, last_end)
        segments_sum  = sum(s.duration for s in kills)

        mode = SPEEDRUN_RAID_MODE.get(raid, "25H")
        table_name = f"{raid}.{mode}"
        # Row: (report_id, total_length, segments_sum, guild, faction)
        result[table_name] = [report_id, total_length, segments_sum, "", None]

    return result


def make_report_speedrun_wrap(report_name: str, rewrite=False):
    speedrun_path = Directories.logs.joinpath(report_name, FileNames.logs_speedrun)
    if not rewrite and speedrun_path.is_file():
        return

    pc = perf_counter()
    try:
        data = _make_speedrun(report_name)
        speedrun_path.json_write(data)
        LOGGER.debug(f'{get_ms_str(pc)} | {report_name:50} | Done speedrun')
        return data
    except Exception:
        LOGGER.exception(f'{get_ms_str(pc)} | {report_name:50} | Speedrun error')


def _test():
    from pprint import pprint
    report_name = "24-05-10--21-04--Jengo--Lordaeron"
    pprint(_make_speedrun(report_name))


if __name__ == "__main__":
    _test()
