// Ported verbatim from static/report_main.js
export const IGNORED_ENCOUNTERS = ['Custom Slice', 'Gunship', 'Valithria Dreamwalker'] as const

export const IGNORED_ENCOUNTER_MODES = ['TBD', 'All'] as const

export const POINTS = [100, 99, 95, 90, 75, 50, 25, 0] as const

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
