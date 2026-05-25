"""
Flask Blueprint for /top, /character, /pve_stats data APIs.

POST data routes only — GET page routes are handled by the Vue SPA.
"""

from flask import Blueprint, Response, jsonify, request
from pydantic import ValidationError

from api_db import DataCompressed
from top import Top, TopValidation
from top_character import Character, CharacterValidation
from top_points import Points, PointsValidation
from top_pve_stats import PveStats, PveStatsValidation, SPECS_DATA_NOT_IGNORED
from top_raid_rank import RaidRank, RaidRankValidation
from top_speedrun import Speedrun, SpeedrunValidation

top_bp = Blueprint("top", __name__)


@top_bp.errorhandler(ValidationError)
def validation_error(e: ValidationError):
    return jsonify({"error": str(e)}), 400


def _body() -> dict:
    """Parse JSON body; return empty dict on missing/malformed input."""
    return request.get_json(force=True, silent=True) or {}


def _compressed_response(z: DataCompressed) -> Response:
    resp = Response(z.data, content_type="application/json")
    resp.headers["Content-Encoding"] = "gzip"
    resp.headers["Content-Length"] = str(z.size_compressed)
    resp.headers["Content-Length-Full"] = str(z.size)
    return resp


# ── Data routes (POST) ────────────────────────────────────────────────────────

@top_bp.route("/top", methods=["POST"])
def top_data():
    data = TopValidation(**_body())
    try:
        result = Top(data).get_data()
    except FileNotFoundError:
        result = DataCompressed(b'[]')
    return _compressed_response(result)


@top_bp.route("/top_points", methods=["POST"])
def top_points():
    data = PointsValidation(**_body())
    try:
        return _compressed_response(Points(data).parse_top_points())
    except FileNotFoundError:
        return _compressed_response(DataCompressed(b'[]'))


@top_bp.route("/top_speedrun", methods=["POST"])
def top_speedrun():
    data = SpeedrunValidation(**_body())
    try:
        return _compressed_response(Speedrun(data).data())
    except FileNotFoundError:
        return _compressed_response(DataCompressed(b'[]'))


@top_bp.route("/pve_stats", methods=["POST"])
def pve_stats_data():
    data = PveStatsValidation(**_body())
    try:
        return PveStats(data).get_data()
    except FileNotFoundError:
        return jsonify([])


@top_bp.route("/character", methods=["POST"])
def character_data():
    data = CharacterValidation(**_body())
    try:
        return Character(data).get_player_data()
    except FileNotFoundError:
        return jsonify({}), 200


@top_bp.route("/character/<server>/<name>/<spec>")
def character_get(server: str, name: str, spec: str):
    data = CharacterValidation(server=server, name=name, spec=spec)
    try:
        return Character(data).get_player_data()
    except FileNotFoundError:
        return jsonify({}), 200


@top_bp.route("/rank", methods=["POST"])
def raid_rank():
    data = RaidRankValidation(**_body())
    return RaidRank(data).points()
