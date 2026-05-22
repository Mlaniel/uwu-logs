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
  ACTIVE_PCT:   Record<string, number>    // player_name → active% (0-100)
  SPELL_COUNTS: Record<string, number>    // player_name → total spell casts
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
  active_pct: number              // % of fight seconds with activity (0-100)
  casts: number                   // total SPELL_CAST_SUCCESS events
}

export interface RecentReport {
  id: string
  name: string
  server: string
  boss_count: number
  latest_boss: string
  date: string
}

export interface LogEntry extends RecentReport {
  realm: string     // specific realm (Icecrown, Lordaeron…)
  server: string    // provider (Warmane, WoW Circle…)
  duration: number  // total raid duration in seconds
}

export interface LogsApiResponse {
  results: LogEntry[]
  total: number                       // count before the 200-row cap
  servers: Record<string, string[]>   // provider → [realms]
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

// Per-type hit statistics from format_hits_data() in logs_dmg_breakdown.py.
// All numeric values are pre-formatted strings with space thousands-separators ("1 234").
// hits_avg / crits_avg: [max, top10%avg, top50%avg, bot50%avg, bot10%avg, min]
export interface HitStats {
  total: string        // hits + crits count
  hits: string         // non-crit count
  crits: string        // crit count
  percent: string      // crit rate e.g. "20.0%"
  hit_avg: string      // avg non-crit value
  hits_avg: string[]   // [max, top10%avg, top50%avg, bot50%avg, bot10%avg, min]
  crit_avg: string     // avg crit value
  crits_avg: string[]  // same structure for crits
}

// Per-spell hit data split by direct (HIT) vs periodic (DOT).
export interface SpellHitData {
  HIT: HitStats
  DOT: HitStats
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
  HITS: Record<string, SpellHitData>
  MISSES: Record<string, string>
  // Miss type counts per spell: { MISS, DODGE, PARRY, RESIST, ABSORB, IMMUNE, BLOCK, GLANCING, REFLECT }
  MISS_DETAILED: Record<string, Record<string, string>>
  // Damage reduction amounts per spell: { OVERKILL, RESISTED, ABSORBED, GLANCED }
  REDUCED_DETAILED: Record<string, Record<string, string>>
  TARGETS: TargetGroups
  PETS: Record<string, string>
}

// One spell row assembled from PlayerApiResponse for SpellTable display.
// Extended fields are populated by usePlayer; absent in Compare's simpler rows.
export interface SpellRow {
  spell_id: string
  name: string
  icon: string
  color: string
  actual: string
  percent: number
  casts: string

  // ── Direct hit breakdown ────────────────────────────────────────────────────
  hit_total?: string     // combined direct+dot hits+crits count
  direct_hits?: string   // direct non-crit count
  direct_crits?: string  // direct crit count
  crit_pct?: string      // combined crit% (direct+dot)
  avg_hit?: string       // avg direct non-crit
  avg_crit?: string      // avg direct crit
  max_hit?: string       // max direct hit
  max_crit?: string      // max direct crit

  // ── Periodic (DoT) breakdown ────────────────────────────────────────────────
  dot_hits?: string      // dot non-crit tick count
  dot_crits?: string     // dot crit tick count
  dot_crit_pct?: string  // dot crit %
  dot_avg_hit?: string   // avg dot tick
  dot_avg_crit?: string  // avg dot crit tick
  dot_max_hit?: string   // max dot tick

  // ── Miss types (counts) ─────────────────────────────────────────────────────
  misses?: string        // total miss events
  miss?: string          // straight MISS
  dodge?: string         // DODGE
  parry?: string         // PARRY
  resist_miss?: string   // RESIST (count)
  absorb_miss?: string   // full-ABSORB miss
  immune?: string        // IMMUNE
  glancing?: string      // GLANCING blow count
  block?: string         // BLOCK
  reflect?: string       // REFLECT

  // ── Damage modifiers (amounts) ──────────────────────────────────────────────
  overkill?: string      // overkill damage amount
  resisted?: string      // resisted damage amount
  absorbed?: string      // absorbed (shield) damage amount
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

// All three graph datasets bundled together — passed from DpsChart to Report
// so the parent can derive per-player stats for any selected time window.
export interface AllGraphData {
  damage: DamageGraphData | null
  heal: DamageGraphData | null
  taken: DamageGraphData | null
}

// One boss encounter region within the full raid timeline.
export interface BossRegion {
  name:      string
  is_kill:   boolean
  start_sec: number   // second offset from raid start
  end_sec:   number
}

// Response from GET /api/v2/reports/:id/raid_graph/
// Single continuous timeline covering the full raid (trash included).
export interface RaidGraphData {
  labels:   string[]
  damage:   number[]
  heal:     number[]
  taken:    number[]
  players?: {
    damage: Record<string, number[]>
    heal:   Record<string, number[]>
    taken:  Record<string, number[]>
  }
  boss_regions: BossRegion[]
}

// Response from GET /api/v2/reports/:id/deaths/
export interface DeathApiResponse {
  DEATHS: Record<string, DeathEntry>    // key: "seconds-playername"
  CLASSES: Record<string, string>       // guid → class_name
  PLAYERS: Record<string, string>       // name → guid
  GUIDS: Record<string, { name: string } | string>  // guid → {name, ...} or name
  SPELLS: Record<string, SpellInfo>
}
