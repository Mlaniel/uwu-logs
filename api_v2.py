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


# ─── SPA catch-all (add last in Z_SERVER.py, not here) ───────────────────────
# See the comment in Z_SERVER.py — the catch-all must be the very last route
# registered on the main app, after all blueprints are registered.
