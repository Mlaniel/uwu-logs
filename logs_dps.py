from collections import defaultdict

import logs_base
from c_bosses import BOSSES_FROM_HTML
from h_debug import running_time

FLAGS = {'SWING_DAMAGE', 'RANGE_DAMAGE', 'SPELL_DAMAGE', 'SPELL_PERIODIC_DAMAGE', 'DAMAGE_SHIELD'}
FLAG_HEAL = {'SPELL_HEAL', 'SPELL_PERIODIC_HEAL'}

def get_raw_data(logs: list[str], guids: set[str]):
    data = defaultdict(int)

    for line in logs:
        if "DAMAGE" not in line:
            continue
        _line = line.split(',', 10)
        if _line[2] not in guids:
            continue
        if _line[1] not in FLAGS:
            continue
        data[_line[0][-12:-2]] += int(_line[9])

    return data

# 5% faster idk why
def get_raw_data(logs: list[str], source_guids: set[str], filter_guids: set[str]):
    data: defaultdict[str, int] = defaultdict(int)

    for line in logs:
        if "DAMAGE" not in line:
            continue
        try:
            timestamp, flag, sGUID, _, tGUID, _, _, _, _, damage, _ = line.split(',', 10)
        except ValueError:
            continue
        if sGUID not in source_guids:
            continue
        if tGUID in filter_guids:
            continue
        if flag not in FLAGS:
            continue
        data[timestamp[-12:-2]] += int(damage)

    return data

def to_int(s: str):
    parts = s.split(":", 2)
    if len(parts) == 3:
        return int(parts[0]) * 36000 + int(parts[1]) * 600 + int(parts[2].replace('.', ''))
    return int(parts[0]) * 600 + int(parts[1].replace('.', ''))

def convert_to_continuous_dps_seconds(data: dict[str, int]):
    DPS = {}
    total_dps = 0
    last_key = list(data)[-1]
    
    for sec_from_start in range(last_key//10+1):
        current_dps = 0
        for tenth_of_sec in range(10):
            current_key = sec_from_start*10+tenth_of_sec
            current_dps += data.get(current_key, 0)

        total_dps = total_dps + current_dps
        currentdps = total_dps / (sec_from_start+1)
        DPS[sec_from_start] = round(currentdps, 1)
    
    return DPS

def convert_to_continuous_dps_custom(data: dict[int, int], refresh_window=10):
    DPS = {}
    LAST_KEY = list(data)[-1]
    if not refresh_window:
        refresh_window = 1

    total_dps = 0
    for sec_from_start in range(LAST_KEY//10+1):
        for tenth_of_sec in range(10):
            current_key = sec_from_start*10+tenth_of_sec
            total_dps += data.get(current_key, 0)
            
            current_sec = current_key + 1
            if current_sec % refresh_window == 0:
                current_dps = total_dps / current_sec * 10
                DPS[current_sec] = round(current_dps, 1)
            
            if current_key == LAST_KEY:
                break

    return DPS

def convert_to_slice_dps_custom(data: dict[int, int], refresh_window=None):
    DPS = {0: 0}
    LAST_KEY = list(data)[-1]
    if not refresh_window:
        refresh_window = 1

    current_dps = 0
    for sec_from_start in range(LAST_KEY//10+1):
        for tenth_of_sec in range(10):
            current_key = sec_from_start*10+tenth_of_sec
            current_dps += data.get(current_key, 0)
        
        current_sec = sec_from_start + 1
        if current_sec % refresh_window == 0:
            DPS[current_sec] = round(current_dps/refresh_window, 1)
            current_dps = 0

    return DPS

def convert_to_dps(data: dict[int, int], refresh_window=None):
    try:
        refresh_window = int(refresh_window)
    except:
        pass
    
    if not refresh_window:
        return convert_to_continuous_dps_seconds(data)
    return convert_to_slice_dps_custom(data, int(refresh_window))

def convert_keys(data: dict[str, int], pull_start_line: str):
    if not data:
        return
    
    _timestamp = pull_start_line.split(",", 1)[0][-12:-2]
    FIRST_KEY = to_int(_timestamp)
    for k in list(data):
        new_key = to_int(k) - FIRST_KEY
        if new_key < 0:
            new_key = new_key + 864000
        data[new_key] = data.pop(k)

def convert_keys_to_str(data: dict[int, int]):
    for k in list(data):
        seconds = k % 60
        minutes = k // 60
        data[f"{minutes:0>2}:{seconds:0>2}"] = data.pop(k)


def get_raw_data_all_players(
    logs: list[str],
    guid_to_player: dict[str, str],
    all_guids: set[str],
) -> dict[str, dict[str, int]]:
    """Single log scan → {player_name: {timestamp_str: damage}}."""
    per_player: dict[str, defaultdict] = {}
    for line in logs:
        if "DAMAGE" not in line:
            continue
        try:
            timestamp, flag, sGUID, _, tGUID, _, _, _, _, damage, _ = line.split(',', 10)
        except ValueError:
            continue
        if sGUID not in guid_to_player:
            continue
        if tGUID in all_guids:
            continue
        if flag not in FLAGS:
            continue
        player_name = guid_to_player[sGUID]
        if player_name not in per_player:
            per_player[player_name] = defaultdict(int)
        per_player[player_name][timestamp[-12:-2]] += int(damage)
    return per_player


def get_raw_data_all_players_heal(
    logs: list[str],
    guid_to_player: dict[str, str],
) -> dict[str, dict[str, int]]:
    """Single log scan → {player_name: {timestamp_str: effective_heal}} for all healers."""
    per_player: dict[str, defaultdict] = {}
    for line in logs:
        if "_H" not in line:
            continue
        try:
            timestamp, flag, sGUID, _, _, _, _, _, _, d, ok, _ = line.split(',', 11)
        except ValueError:
            continue
        if sGUID not in guid_to_player:
            continue
        if flag not in FLAG_HEAL:
            continue
        effective = int(d) - int(ok)
        if effective <= 0:
            continue
        player_name = guid_to_player[sGUID]
        if player_name not in per_player:
            per_player[player_name] = defaultdict(int)
        per_player[player_name][timestamp[-12:-2]] += effective
    return per_player


def get_raw_data_all_players_taken(
    logs: list[str],
    guid_to_player: dict[str, str],
    player_pet_guids: set[str],
) -> dict[str, dict[str, int]]:
    """Single log scan → {player_name: {timestamp_str: damage_taken}} for all players."""
    # Spell IDs for scripted mechanics that deal unavoidable mass damage and skew the graph.
    TAKEN_IGNORE_SPELLS = {",72350,"}  # Fury of Frostmourne (Lich King)

    per_player: dict[str, defaultdict] = {}
    for line in logs:
        if "DAMAGE" not in line:
            continue
        if any(s in line for s in TAKEN_IGNORE_SPELLS):
            continue
        try:
            timestamp, flag, _, _, tGUID, _, _, _, _, damage, _, _ = line.split(',', 11)
        except ValueError:
            continue
        if tGUID not in player_pet_guids:
            continue
        if flag not in FLAGS:
            continue
        player_name = guid_to_player.get(tGUID)
        if player_name is None:
            continue
        if player_name not in per_player:
            per_player[player_name] = defaultdict(int)
        per_player[player_name][timestamp[-12:-2]] += int(damage)
    return per_player


class Dps(logs_base.THE_LOGS):
    @logs_base.cache_wrap
    def get_all_players_raw(self, s: int, f: int) -> dict[str, dict[int, int]]:
        """Single-pass scan → {player_name: {offset_tenth_sec: damage}} for all players."""
        logs_slice = self.LOGS[s:f]
        if not logs_slice:
            return {}

        all_guids = self.get_players_and_pets_guids()

        # Build guid → player_name (includes pets mapped to their master)
        guid_to_player: dict[str, str] = {}
        for player_name in self.CLASSES_NAMES:
            for guid in self.get_units_controlled_by(player_name):
                guid_to_player[guid] = player_name

        raw_by_ts = get_raw_data_all_players(logs_slice, guid_to_player, all_guids)

        # Convert timestamp strings to integer offsets from the fight start
        first_key = to_int(logs_slice[0].split(",", 1)[0][-12:-2])
        result: dict[str, dict[int, int]] = {}
        for player_name, ts_map in raw_by_ts.items():
            converted: dict[int, int] = {}
            for ts_str, dmg in ts_map.items():
                offset = to_int(ts_str) - first_key
                if offset < 0:
                    offset += 864000
                converted[offset] = converted.get(offset, 0) + dmg
            result[player_name] = converted
        return result

    @logs_base.cache_wrap
    def get_all_players_raw_heal(self, s: int, f: int) -> dict[str, dict[int, int]]:
        """Single-pass scan → {player_name: {offset_tenth_sec: effective_heal}}."""
        logs_slice = self.LOGS[s:f]
        if not logs_slice:
            return {}

        guid_to_player: dict[str, str] = {}
        for player_name in self.CLASSES_NAMES:
            for guid in self.get_units_controlled_by(player_name):
                guid_to_player[guid] = player_name

        raw_by_ts = get_raw_data_all_players_heal(logs_slice, guid_to_player)

        first_key = to_int(logs_slice[0].split(",", 1)[0][-12:-2])
        result: dict[str, dict[int, int]] = {}
        for player_name, ts_map in raw_by_ts.items():
            converted: dict[int, int] = {}
            for ts_str, amount in ts_map.items():
                offset = to_int(ts_str) - first_key
                if offset < 0:
                    offset += 864000
                converted[offset] = converted.get(offset, 0) + amount
            result[player_name] = converted
        return result

    @logs_base.cache_wrap
    def get_all_players_raw_taken(self, s: int, f: int) -> dict[str, dict[int, int]]:
        """Single-pass scan → {player_name: {offset_tenth_sec: damage_taken}}."""
        logs_slice = self.LOGS[s:f]
        if not logs_slice:
            return {}

        all_guids = self.get_players_and_pets_guids()

        guid_to_player: dict[str, str] = {}
        for player_name in self.CLASSES_NAMES:
            for guid in self.get_units_controlled_by(player_name):
                guid_to_player[guid] = player_name

        raw_by_ts = get_raw_data_all_players_taken(logs_slice, guid_to_player, all_guids)

        first_key = to_int(logs_slice[0].split(",", 1)[0][-12:-2])
        result: dict[str, dict[int, int]] = {}
        for player_name, ts_map in raw_by_ts.items():
            converted: dict[int, int] = {}
            for ts_str, amount in ts_map.items():
                offset = to_int(ts_str) - first_key
                if offset < 0:
                    offset += 864000
                converted[offset] = converted.get(offset, 0) + amount
            result[player_name] = converted
        return result

    @logs_base.cache_wrap
    def get_spell_casts_per_player(self, s: int, f: int) -> dict[str, int]:
        """Scan SPELL_CAST_SUCCESS events → {player_name: cast_count} (player only, not pets)."""
        logs_slice = self.LOGS[s:f]
        if not logs_slice:
            return {}

        guid_to_player: dict[str, str] = {}
        for player_name in self.CLASSES_NAMES:
            guid = self.name_to_guid(player_name)
            if guid:
                guid_to_player[guid] = player_name

        counts: dict[str, int] = {}
        for line in logs_slice:
            if 'SPELL_CAST_SUCCESS' not in line:
                continue
            parts = line.split(',', 3)
            if len(parts) < 3 or parts[1] != 'SPELL_CAST_SUCCESS':
                continue
            player = guid_to_player.get(parts[2])
            if player is not None:
                counts[player] = counts.get(player, 0) + 1

        return counts

    def get_active_seconds_per_player(self, s: int, f: int) -> tuple[dict[str, int], int]:
        """Returns ({player: active_secs}, fight_duration_secs). Reuses cached raw data."""
        logs_slice = self.LOGS[s:f]
        if not logs_slice:
            return {}, 0

        first = to_int(logs_slice[0].split(",", 1)[0][-12:-2])
        last  = to_int(logs_slice[-1].split(",", 1)[0][-12:-2])
        diff  = last - first
        if diff < 0:
            diff += 864000
        duration_secs = max(1, diff // 10)

        dmg_raw  = self.get_all_players_raw(s, f)
        heal_raw = self.get_all_players_raw_heal(s, f)

        result: dict[str, int] = {}
        for player in set(dmg_raw) | set(heal_raw):
            active_tenths: set[int] = set()
            if player in dmg_raw:
                active_tenths.update(dmg_raw[player].keys())
            if player in heal_raw:
                active_tenths.update(heal_raw[player].keys())
            result[player] = len({t // 10 for t in active_tenths})

        return result, duration_secs

    @logs_base.cache_wrap
    def get_dps(self, s, f, player: str):
        logs_slice = self.LOGS[s:f]
        all_guids = self.get_players_and_pets_guids()
        if player:
            source_guids = self.get_units_controlled_by(player)
        else:
            source_guids = all_guids
        data = get_raw_data(logs_slice, source_guids, all_guids)
        convert_keys(data, logs_slice[0])
        return data

    @running_time
    def get_dps_wrap(self, data: dict):
        if not data:
            return {}

        enc_name = data.get("boss")
        attempt = data.get("attempt")
        if not enc_name or not attempt:
            return {}
        
        enc_data = self.get_enc_data()
        enc_name = BOSSES_FROM_HTML[enc_name]
        s, f = enc_data[enc_name][int(attempt)]
        player = data.get("player_name")
        _data = self.get_dps(s, f, player)
        if not _data:
            return {}
        refresh_window = data.get("sec")
        new_data = convert_to_dps(_data, refresh_window)
        convert_keys_to_str(new_data)
        return new_data




def test():
    report = Dps("22-12-30--20-10--Nomadra--Lordaeron")
    report.LOGS
    s, f = report.ENCOUNTER_DATA["The Lich King"][-2]
    dps = report.get_dps(s, f, "Nomadra")
    new_data = convert_to_dps(dps, 1)
    convert_keys_to_str(new_data)
    for x in list(new_data)[:30]:
        print(f"{x} | {new_data[x]:>9,}")

if __name__ == "__main__":
    test()
