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
