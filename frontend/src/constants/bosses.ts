// Ported verbatim from static/report_main.js
export const IGNORED_ENCOUNTERS = ['Custom Slice', 'Gunship', 'Valithria Dreamwalker'] as const

export const IGNORED_ENCOUNTER_MODES = ['TBD', 'All'] as const

export const POINTS = [100, 99, 95, 90, 75, 50, 25, 0] as const

// WoW class colors matching the live site's CSS class variables.
export const CLASS_COLORS: Record<string, string> = {
  'death-knight': '#C41E3A',
  'druid':        '#FF7C0A',
  'hunter':       '#AAD372',
  'mage':         '#3FC7EB',
  'paladin':      '#F48CBA',
  'priest':       '#CCCCCC',
  'rogue':        '#FFF468',
  'shaman':       '#0070DD',
  'warlock':      '#8788EE',
  'warrior':      '#C69B3A',
}

// Mirrors c_player_classes.CLASS_FROM_HTML in Python.
export const CLASS_DISPLAY_NAMES: Record<string, string> = {
  'death-knight': 'Death Knight',
  'druid':        'Druid',
  'hunter':       'Hunter',
  'mage':         'Mage',
  'paladin':      'Paladin',
  'priest':       'Priest',
  'rogue':        'Rogue',
  'shaman':       'Shaman',
  'warlock':      'Warlock',
  'warrior':      'Warrior',
}
