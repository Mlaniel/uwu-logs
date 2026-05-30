import json
import sqlite3
from collections import defaultdict

from pydantic import BaseModel, field_validator

from api_db import (
    DB,
    DataCompressed,
    Table,
)
from api_top_db_v2 import TopDB
from c_path import Directories, StrEnum
from c_server_phase import get_server_phase
from h_server_fix import get_servers


API_EXAMPLES = [
    {
        "server": "Lordaeron",
        "raid": "Icecrown Citadel",
        "mode": "25H",
    },
]

TOP_N = 10


# ── SpeedrunDB (full-raid-clear pipeline storage) ─────────────────────────────

class Columns(StrEnum):
    REPORT_ID = "report_id"
    TOTAL_LENGTH = "total_length"
    SEGMENTS_SUM = "segments_sum"
    GUILD = "guild"
    FACTION = "faction"


class TableSpeedrun(Table):
    without_row_id = True
    COLUMNS_ORDERED = list(Columns.__members__.values())
    COLUMNS_TABLE_CREATE = [
        f"{COLUMNS_ORDERED[0]} PRIMARY KEY",
        *COLUMNS_ORDERED[1:],
    ]


class SpeedrunDB(DB):
    def __init__(self, server: str, new=False) -> None:
        path = Directories.speedrun / f"{server}.db"
        super().__init__(path, new=new)
        self.server = server

    def add_new_data(self, table_name: str, rows: list):
        """rows: list of [report_id, total_length, segments_sum, guild, faction]"""
        table = TableSpeedrun(table_name)
        self.add_new_rows(table, [tuple(row) for row in rows])


# ── API: per-boss fastest-kill grid ───────────────────────────────────────────

class SpeedrunValidation(BaseModel):
    server: str
    raid: str
    mode: str = "25H"
    class_i: int = -1

    model_config = {
        "json_schema_extra": {
            "examples": API_EXAMPLES,
        }
    }

    @field_validator('server')
    @classmethod
    def validate_server(cls, server: str):
        servers = get_servers()
        if server not in servers:
            _list = ', '.join(servers)
            raise ValueError(f"[server] value must be from [{_list}]")
        return server

    @field_validator('mode')
    @classmethod
    def validate_mode(cls, mode: str):
        mode = mode.upper()
        modes = ["10N", "10H", "25N", "25H"]
        if mode not in modes:
            raise ValueError(f"[mode] must be one of {modes}")
        return mode

    @field_validator('class_i')
    @classmethod
    def validate_class_i(cls, v: int):
        if v < -1 or v > 9:
            raise ValueError("[class_i] must be -1 (all) or 0-9")
        return v


class SpeedrunBossGrid(TopDB):
    def __init__(self, model: SpeedrunValidation) -> None:
        super().__init__(model.server)
        phase = get_server_phase(model.server)
        self.encounters = [e for e in phase.ALL_BOSSES if e.raid == model.raid]
        self.mode = model.mode
        self.class_i = model.class_i

    def get_data(self) -> DataCompressed:
        result = {}
        for encounter in self.encounters:
            table_name = DB.get_table_name(encounter.name, self.mode)
            result[encounter.name] = self._query_boss(table_name)
        j = json.dumps(result, separators=(",", ":"))
        return DataCompressed(j.encode())

    def _query_boss(self, table_name: str) -> list:
        if self.class_i < 0:
            query = f"""
            SELECT report_id, MIN(duration) AS t
            FROM [{table_name}]
            GROUP BY report_id
            ORDER BY t ASC
            LIMIT {TOP_N}
            """
        else:
            spec_min = self.class_i * 4
            spec_max = self.class_i * 4 + 3
            query = f"""
            SELECT report_id, MIN(duration) AS t
            FROM [{table_name}]
            WHERE report_id IN (
                SELECT DISTINCT report_id FROM [{table_name}]
                WHERE spec >= {spec_min} AND spec <= {spec_max}
            )
            GROUP BY report_id
            ORDER BY t ASC
            LIMIT {TOP_N}
            """
        try:
            return self.cursor.execute(query).fetchall()
        except sqlite3.OperationalError:
            return []


def test1():
    sv = SpeedrunValidation(**API_EXAMPLES[0])
    grid = SpeedrunBossGrid(sv)
    for boss, rows in json.loads(grid.get_data().data).items():
        print(f"{boss}: {rows[:2]}")

if __name__ == "__main__":
    test1()
