// API shapes derived from Python source.
// See logs_main.py (format_report_page_data), logs_check_difficulty.py (LogsSegment, BossSegments).

// One stat cell from format_report_page_data().
// value: space-separated string e.g. "1 234 567", empty string "" when value is zero.
// per_second: float. percent: int 0-100 relative to column max.
export interface StatCell {
  value: string
  per_second: number
  percent: number
}

// One pull attempt — maps to LogsSegment in logs_check_difficulty.py.
export interface BossAttempt {
  encounter_name: string
  difficulty: string              // "25H" | "25N" | "10H" | "10N" | "TBD"
  attempt: number
  attempt_from_last_kill: number
  attempt_type: 'kill' | 'wipe'
  duration: number                // seconds
  duration_str: string            // "5:23"
  href: string                    // "?boss=lich-king&mode=25H&attempt=3&s=1234&f=5678"
}

// Boss group in sidebar — maps to BossSegments in logs_check_difficulty.py.
// boss_name "all" is the synthetic "view all bosses" entry — exclude from sidebar render.
export interface BossGroup {
  boss_name: string
  href: string
  text: string
  segments: BossAttempt[]
}

// Raw API response from GET /api/v2/reports/:id/
// DATA includes a "Total" key in each column dict — skip it when building Player[].
export interface ReportApiResponse {
  REPORT_ID: string
  REPORT_NAME: string
  SERVER: string
  DURATION: number
  DURATION_STR: string
  SEGMENTS: [number, number][]
  PLAYER_CLASSES: Record<string, string>    // { "Razac": "Death Knight" }
  SEGMENTS_LINKS: BossGroup[]
  SEGMENTS_KILLS: BossAttempt[]
  DATA: {
    useful:     Record<string, StatCell>
    damage:     Record<string, StatCell>
    heal:       Record<string, StatCell>
    heal_total: Record<string, StatCell>
    taken:      Record<string, StatCell>
  }
  // Python tuple → JSON array: ["Frost Death Knight", "spell_deathknight_frostpresence"]
  SPECS: Record<string, [string, string]>
}

// Assembled player row — built by useReport from the raw response.
// useful is null for players with no useful damage (healers in damage context).
export interface Player {
  name: string
  spec_name: string
  spec_icon: string
  class_name: string              // CSS class: class_name.toLowerCase().replace(' ', '-')
  useful: StatCell | null
  damage: StatCell
  heal: StatCell
  heal_total: StatCell
  taken: StatCell
}

export interface RecentReport {
  id: string
  name: string
  server: string
  boss_count: number
  latest_boss: string
  date: string
}

// ── Phase 1b types ──────────────────────────────────────────────────────────

// Spell metadata from Spell.to_dict() in logs_spells_list.py.
// color is a CSS color string (matches spell school color classes).
export interface SpellInfo {
  id: string
  name: string
  color: string
  icon: string
}

// Target groups from _order_targets(): each value is { target_id: display_name }.
export interface TargetGroups {
  NPCS: Record<string, string>
  Players: Record<string, string>
  Pets: Record<string, string>
}

// Response from GET /api/v2/reports/:id/player/:name/
// ACTUAL/CASTS keys are spell_id strings. Values are formatted strings ("1 234 567").
export interface PlayerApiResponse {
  SOURCE_NAME: string
  IS_PLAYER: boolean
  SOURCE: string
  OWNER_NAME?: string
  ACTUAL: Record<string, string>
  ACTUAL_PERCENT: Record<string, number>
  CASTS: Record<string, string>
  SPELLS_DATA: Record<string, SpellInfo>
  TARGETS: TargetGroups
  PETS: Record<string, string>          // pet_guid → pet_name
}

// One spell row assembled from PlayerApiResponse for SpellTable display.
export interface SpellRow {
  spell_id: string
  name: string
  icon: string
  color: string
  actual: string
  percent: number
  casts: string
}

// One death entry from get_deaths_v2_wrap(). The `death` field is a list of
// normalized combat log lines: [timestamp, flag_part1, flag_part2, source,
//   spell_id, spell_name, amount?, ...extra]
export type DeathLogLine = (string | number)[]

export interface DeathEntry {
  player: string
  from_start: string           // "MM:SS.mmm"
  death: DeathLogLine[]
}

// ── Timeline ─────────────────────────────────────────────────────────────────

// One cast event: [delta_ms, flag, source_name, target_name, target_guid, etc_str]
export type CastEvent = [number, string, string, string, string, string]

// Response from POST /api/v2/reports/:id/timeline
// DATA keys are spell_id strings; values are arrays of CastEvent.
export interface TimelineApiResponse {
  DATA: Record<string, CastEvent[]>
  SPELLS: Record<string, SpellInfo>
  RDURATION: number      // fight duration in seconds
  NAME: string           // player name
  CLASS: string          // class name (lowercase)
}

// Response from GET /api/v2/reports/:id/damage_graph/
// labels: one MM:SS string per second of the fight
// players: {name: cumulative_damage_at_each_second[]}
export interface DamageGraphData {
  labels: string[]
  players: Record<string, number[]>
}

// Response from GET /api/v2/reports/:id/deaths/
export interface DeathApiResponse {
  DEATHS: Record<string, DeathEntry>    // key: "seconds-playername"
  CLASSES: Record<string, string>       // guid → class_name
  PLAYERS: Record<string, string>       // name → guid
  GUIDS: Record<string, string>         // guid → name
  SPELLS: Record<string, SpellInfo>
}
