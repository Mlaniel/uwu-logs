"""
Flask Blueprint for /api/v2/ — JSON endpoints consumed by the Vue SPA.

All existing routes in Z_SERVER.py are untouched. These are additive.
Register with: app.register_blueprint(apiv2_bp)
"""

from flask import Blueprint, jsonify, request

import logs_calendar
import logs_main
from c_bosses import BOSSES_FROM_HTML
from c_path import Directories

apiv2_bp = Blueprint("apiv2", __name__, url_prefix="/api/v2")

RECENT_REPORTS_LIMIT = 20


# ─── Serialization helpers ────────────────────────────────────────────────────

def _serialize_attempt(s) -> dict:
    return {
        "encounter_name": s.encounter_name,
        "difficulty": s.difficulty,
        "attempt": s.attempt,
        "attempt_from_last_kill": s.attempt_from_last_kill,
        "attempt_type": s.attempt_type,
        "duration": s.duration,
        "duration_str": s.duration_str,
        "href": s.href,
    }


def _serialize_boss_group(bg) -> dict:
    return {
        "boss_name": bg.boss_name,
        "href": bg.href,
        "text": bg.text,
        "segments": [_serialize_attempt(s) for s in bg.segments],
    }


# ─── Report existence check ───────────────────────────────────────────────────

def _report_exists(report_id: str) -> bool:
    report_folder = Directories.logs / report_id
    if report_folder.is_dir():
        return True
    backup_folder = report_folder.backup_path()
    return backup_folder.is_dir()


def _load_report(report_id: str):
    """Load report, returning (report, None) or (None, error_response)."""
    if not _report_exists(report_id):
        return None, (jsonify({"error": "Report not found or has been deleted."}), 404)
    try:
        from Z_SERVER import load_report
        return load_report(report_id), None
    except Exception as exc:
        return None, (jsonify({"error": str(exc)}), 500)


# ─── GET /api/v2/reports/<id>/ ────────────────────────────────────────────────

@apiv2_bp.route("/reports/<report_id>/")
def report_overview(report_id: str):
    report, err = _load_report(report_id)
    if err:
        return err

    try:
        default_params = report.get_default_params(request)
        segments = default_params["SEGMENTS"]
        boss_name = request.args.get("boss")
        data = report.get_report_page_all_wrap(segments, boss_name)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    payload = {**default_params, **data}

    # Serialize class instances — jsonify() cannot handle them directly
    payload["SEGMENTS_LINKS"] = [_serialize_boss_group(bg) for bg in payload["SEGMENTS_LINKS"]]
    payload["SEGMENTS_KILLS"] = [_serialize_attempt(s) for s in payload["SEGMENTS_KILLS"]]

    # Convert StatCell dicts — DATA values are already plain dicts, no change needed.
    # SPECS values are tuples → JSON arrays automatically via jsonify.

    # Drop keys that are only needed for Jinja templates
    for key in ("PATH", "QUERY", "QUERY_NO_CUSTOM"):
        payload.pop(key, None)

    return jsonify(payload)


# ─── GET /api/v2/recent_reports/ ─────────────────────────────────────────────

@apiv2_bp.route("/recent_reports/")
def recent_reports():
    try:
        df = logs_calendar.read_main_df()
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    if df.empty:
        return jsonify([])

    # Sort by year/month/day/time descending, take most recent N
    sort_cols = [c for c in ("year", "month", "day", "time") if c in df.columns]
    if sort_cols:
        df = df.sort_values(by=sort_cols, ascending=False)

    df = df.head(RECENT_REPORTS_LIMIT)

    results = []
    for report_id, row in df.iterrows():
        fights = row.get("fight", ())
        boss_count = len(fights) if fights else 0
        latest_boss = fights[-1] if fights else ""

        year = int(row.get("year", 0))
        month = int(row.get("month", 0))
        day = int(row.get("day", 0))
        date_str = f"20{year:02d}-{month:02d}-{day:02d}" if year else ""

        results.append({
            "id": report_id,
            "name": row.get("author", report_id),
            "server": row.get("server", ""),
            "boss_count": boss_count,
            "latest_boss": latest_boss,
            "date": date_str,
        })

    return jsonify(results)


# ─── GET /api/v2/reports/<id>/player/<name>/ ─────────────────────────────────

@apiv2_bp.route("/reports/<report_id>/player/<path:source>/")
def player_breakdown(report_id: str, source: str):
    report, err = _load_report(report_id)
    if err:
        return err

    try:
        default_params = report.get_default_params(request)
        segments = default_params["SEGMENTS"]
        view = request.args.get("view", "damage")
        target_guid = request.args.get("target")

        heal = view == "heal"
        taken = view == "taken"
        data = report.get_numbers_breakdown_wrap(
            segments, source, filter_guid=target_guid, heal=heal, taken=taken
        )
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    # SPELLS_DATA values are plain dicts from Spell.to_dict() — JSON-safe.
    # TARGETS / PETS are already plain dicts.
    return jsonify(data)


# ─── GET /api/v2/reports/<id>/deaths/ ────────────────────────────────────────

@apiv2_bp.route("/reports/<report_id>/deaths/")
def report_deaths(report_id: str):
    report, err = _load_report(report_id)
    if err:
        return err

    try:
        default_params = report.get_default_params(request)
        segments = default_params["SEGMENTS"]
        data = report.get_deaths_v2_wrap(segments)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    # SPELLS: dict of spell_id → Spell objects — serialize them.
    if "SPELLS" in data:
        data["SPELLS"] = {
            str(k): v.to_dict() if hasattr(v, "to_dict") else v
            for k, v in data["SPELLS"].items()
        }

    # CLASSES/PLAYERS/GUIDS are plain dicts of strings — JSON-safe.
    # DEATHS values contain lists of lists (normalized log lines) — JSON-safe.
    return jsonify(data)


# ─── POST /api/v2/reports/<id>/timeline ──────────────────────────────────────
# Body: { "boss": "<boss_html_name>", "attempt": <n>, "name": "<player_name>" }
# Returns JSON from get_spell_history_wrap_json — already serialized.

@apiv2_bp.route("/reports/<report_id>/timeline", methods=["POST"])
def report_timeline(report_id: str):
    report, err = _load_report(report_id)
    if err:
        return err

    body = request.get_json(force=True, silent=True) or {}
    boss_name_html = body.get("boss")
    player_name = body.get("name")
    attempt_raw = body.get("attempt", 0)

    if not boss_name_html:
        return jsonify({"error": "Missing 'boss' in request body"}), 400
    if not player_name:
        return jsonify({"error": "Missing 'name' in request body"}), 400

    boss_name = BOSSES_FROM_HTML.get(boss_name_html, boss_name_html)

    try:
        attempt_n = int(attempt_raw)
    except (ValueError, TypeError):
        return jsonify({"error": f"'attempt' must be an integer, got {attempt_raw!r}"}), 400

    try:
        boss_data = report.ENCOUNTER_DATA[boss_name]
    except KeyError:
        return jsonify({"error": f"Boss '{boss_name}' not found in report"}), 404

    try:
        s, f = boss_data[attempt_n]
    except IndexError:
        return jsonify({"error": f"Attempt {attempt_n} not found for '{boss_name}'"}), 404

    player_guid = report.name_to_guid(player_name)
    if not player_guid:
        return jsonify({"error": f"Player '{player_name}' not found in report"}), 404

    # Returns a pre-serialized JSON string — pass through directly.
    return report.get_spell_history_wrap_json(s, f, player_guid), 200, {"Content-Type": "application/json"}


# ─── POST /api/v2/reports/<id>/compare/ ──────────────────────────────────────
# Body: { "class": "<class-slug>" }  e.g. "death-knight", "warrior"
# Returns: { PLAYERS, SPELLS, TARGETS } — same shape as get_comparison_data().

@apiv2_bp.route("/reports/<report_id>/compare/", methods=["POST"])
def report_compare(report_id: str):
    report, err = _load_report(report_id)
    if err:
        return err

    body = request.get_json(force=True, silent=True) or {}
    class_name = body.get("class", "").strip()
    if not class_name:
        return jsonify({"error": "Missing 'class' in request body"}), 400

    try:
        default_params = report.get_default_params(request)
        segments = default_params["SEGMENTS"]
        result = report.get_comparison_data(segments, class_name)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    return result, 200, {"Content-Type": "application/json"}


# ─── GET /api/v2/reports/<id>/damage_graph/ ──────────────────────────────────
# Returns cumulative values per second for every player in the given fight
# segment. Pass ?view=damage|heal|taken (default: damage). Boss params are
# required (boss, mode, attempt, s, f) — full-raid is not supported.
#
# Response: { labels: ["0:00", "0:01", ...], players: { name: [int, ...] } }
# Values are cumulative so the frontend can diff adjacent elements for per-sec.

@apiv2_bp.route("/reports/<report_id>/damage_graph/")
def damage_graph(report_id: str):
    report, err = _load_report(report_id)
    if err:
        return err

    graph_view = request.args.get("view", "damage")
    if graph_view not in ("damage", "heal", "taken"):
        graph_view = "damage"

    try:
        default_params = report.get_default_params(request)
        segments = default_params["SEGMENTS"]
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    if not segments or segments[0][0] is None:
        return jsonify({"error": "damage_graph requires a specific boss segment"}), 400

    s, f = segments[0]

    try:
        if graph_view == "heal":
            raw_all = report.get_all_players_raw_heal(s, f)
        elif graph_view == "taken":
            raw_all = report.get_all_players_raw_taken(s, f)
        else:
            raw_all = report.get_all_players_raw(s, f)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    if not raw_all:
        return jsonify({"labels": [], "players": {}})

    last_offset = max(
        (max(offsets.keys()) for offsets in raw_all.values() if offsets),
        default=0,
    )
    n_secs = last_offset // 10 + 1

    # Build MM:SS labels
    labels = []
    for sec in range(n_secs):
        m, sv = divmod(sec, 60)
        labels.append(f"{m}:{sv:02d}")

    # Compute cumulative value per second for each player
    players_out: dict[str, list[int]] = {}
    for player_name, offsets in raw_all.items():
        cumul = 0
        arr = []
        for sec in range(n_secs):
            for tenth in range(10):
                cumul += offsets.get(sec * 10 + tenth, 0)
            arr.append(cumul)
        if cumul > 0:
            players_out[player_name] = arr

    return jsonify({"labels": labels, "players": players_out})


# ─── SPA catch-all (add last in Z_SERVER.py, not here) ───────────────────────
# See the comment in Z_SERVER.py — the catch-all must be the very last route
# registered on the main app, after all blueprints are registered.
