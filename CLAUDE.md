# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

UwU Logs — a World of Warcraft (WotLK 3.3.5) combat log parser for private servers. Users upload `.log` files; the app parses them and displays damage, healing, deaths, auras, and DPS breakdowns.

Live site: https://uwu-logs.xyz/

## Architecture

Three independent Python services (ports defined in `h_other.py`):
- **Z_SERVER.py** — main Flask app (port 5000); serves Jinja2 templates and all primary routes
- **server_top.py** — FastAPI rankings/stats service (port 5020)
- **server_upload.py** — FastAPI file upload service (port 5010)

The `main` branch is Flask + Jinja2. The Vue 3 frontend rewrite lives on the `vue3-rework` branch.

## Running the Dev Stack

```bash
# All three services must run concurrently:
python Z_SERVER.py
python server_top.py        # or: uvicorn server_top:app --port 5020 --proxy-headers
python server_upload.py     # or: uvicorn server_upload:app --port 5010 --proxy-headers
```

Use `/run-dev` to start all three in one shot.

## Required Setup

Download the icons/gear data pack (see README) and extract to the repo root. These directories are not in source control: `static/icons/`, `static/gear/`, `static/item/`, `static/enchant/`.

Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Module Naming Conventions

Modules are organized by prefix — always follow this when creating new files:
- `logs_*` — log parsing and analysis (damage, heals, deaths, auras, DPS)
- `c_*` — constants and configuration (bosses, spells, player classes, server phases, paths)
- `h_*` — helpers/utilities (datetime, debug, server fixes)
- `parser_*` — data parsers (gear, talents, enchants, items)
- `server_*` — backend service entry points
- `top_*` — ranking and stats modules
- `api_*` — database and external API wrappers
- `Z_SERVER.py` — entry point (Z prefix sorts it to the bottom intentionally)

## Boss and Entity Data

Boss GUIDs and fight metadata are hardcoded in `c_bosses.py`. Adding support for a new boss requires updating that file. There is no dynamic config for boss definitions — changes must be made in code.

## Testing

No test suite. Verify changes by running the full dev stack and uploading a real WoW combat log through the web UI.

## Branches and Commit Style

- `main` — stable releases; commit style: `6.39.34 - short description`
- `vue3-rework` — Vue 3 frontend rewrite (active frontend work happens here)

New backend work that requires isolation should go in a dedicated feature branch.
