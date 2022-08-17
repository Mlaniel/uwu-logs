// const LOGS_URL = "https://uwu-logs.xyz";
const LOGS_URL = "http://localhost:5000";
const ICON_CDN_URL = "https://wotlk.evowow.com/static/images/wow/icons/large";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CLASSES = ['Death Knight', 'Druid', 'Hunter', 'Mage', 'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior']
const AURAS_COLUMNS = ['ext', 'self', 'rekt'];
const DATA_KEYS = {
  guid: 'i',
  name: 'n',
  uAmount: 'ua',
  uDPS: 'ud',
  tAmount: 'ta',
  tDPS: 'td',
  spec: 's',
  auras: 'a',
  reportID: 'r',
  duration: 't',
}

const BOSSES = {
  'Icecrown Citadel': [
    'The Lich King',
    'Lord Marrowgar', 'Lady Deathwhisper', 'Gunship', 'Deathbringer Saurfang',
    'Festergut', 'Rotface', 'Professor Putricide',
    'Blood Prince Council', "Blood-Queen Lana'thel",
    'Valithria Dreamwalker', 'Sindragosa'
  ],
  'The Ruby Sanctum': ['Halion', 'Baltharus the Warborn', 'Saviana Ragefire', 'General Zarithrian'],
  'Trial of the Crusader': ["Anub'arak", 'Northrend Beasts', 'Lord Jaraxxus', 'Faction Champions', "Twin Val'kyr"],
  'Vault of Archavon': ['Toravon the Ice Watcher', 'Archavon the Stone Watcher', 'Emalon the Storm Watcher', 'Koralon the Flame Watcher'],
  "Onyxia's Lair": ['Onyxia'],
  'The Eye of Eternity': ['Malygos'],
  'The Obsidian Sanctum': ['Sartharion'],
  'Naxxramas': [
    "Anub'Rekhan", 'Grand Widow Faerlina', 'Maexxna', 'Noth the Plaguebringer', 'Heigan the Unclean',
    'Loatheb', 'Patchwerk', 'Grobbulus', 'Gluth', 'Thaddius', 'Instructor Razuvious', 'Gothik the Harvester',
    'The Four Horsemen', 'Sapphiron', "Kel'Thuzad"
  ],
  'Ulduar': [
    'Flame Leviathan', 'Ignis the Furnace Master', 'Razorscale', 'XT-002 Deconstructor',
    'Assembly of Iron', 'Kologarn', 'Auriaya', 'Hodir', 'Thorim', 'Freya', 'Mimiron',
    'General Vezax', 'Yogg-Saron', 'Algalon the Observer'
  ],
};

const SPECS = [
  ["Death Knight", "class_deathknight", "death-knight"],
  ["Blood", "spell_deathknight_bloodpresence", "death-knight"],
  ["Frost", "spell_deathknight_frostpresence", "death-knight"],
  ["Unholy", "spell_deathknight_unholypresence", "death-knight"],
  ["Druid", "class_druid", "druid"],
  ["Balance", "spell_nature_starfall", "druid"],
  ["Feral Combat", "ability_racial_bearform", "druid"],
  ["Restoration", "spell_nature_healingtouch", "druid"],
  ["Hunter", "class_hunter", "hunter"],
  ["Beast Mastery", "ability_hunter_beasttaming", "hunter"],
  ["Marksmanship", "ability_marksmanship", "hunter"],
  ["Survival", "ability_hunter_swiftstrike", "hunter"],
  ["Mage", "class_mage", "mage"],
  ["Arcane", "spell_holy_magicalsentry", "mage"],
  ["Fire", "spell_fire_firebolt02", "mage"],
  ["Frost", "spell_frost_frostbolt02", "mage"],
  ["Paladin", "class_paladin", "paladin"],
  ["Holy", "spell_holy_holybolt", "paladin"],
  ["Protection", "spell_holy_devotionaura", "paladin"],
  ["Retribution", "spell_holy_auraoflight", "paladin"],
  ["Priest", "class_priest", "priest"],
  ["Discipline", "spell_holy_wordfortitude", "priest"],
  ["Holy", "spell_holy_guardianspirit", "priest"],
  ["Shadow", "spell_shadow_shadowwordpain", "priest"],
  ["Rogue", "class_rogue", "rogue"],
  ["Assassination", "ability_rogue_eviscerate", "rogue"],
  ["Combat", "ability_backstab", "rogue"],
  ["Subtlety", "ability_stealth", "rogue"],
  ["Shaman", "class_shaman", "shaman"],
  ["Elemental", "spell_nature_lightning", "shaman"],
  ["Enhancement", "spell_nature_lightningshield", "shaman"],
  ["Restoration", "spell_nature_magicimmunity", "shaman"],
  ["Warlock", "class_warlock", "warlock"],
  ["Affliction", "spell_shadow_deathcoil", "warlock"],
  ["Demonology", "spell_shadow_metamorphosis", "warlock"],
  ["Destruction", "spell_shadow_rainoffire", "warlock"],
  ["Warrior", "class_warrior", "warrior"],
  ["Arms", "ability_rogue_eviscerate", "warrior"],
  ["Fury", "ability_warrior_innerrage", "warrior"],
  ["Protection", "ability_warrior_defensivestance", "warrior"]
]


const SPECS_SELECT_OPTIONS = {
  "Death Knight": ["Blood", "Frost", "Unholy"],
  "Druid": ["Balance", "Feral Combat", "Restoration"],
  "Hunter": ["Beast Mastery", "Marksmanship", "Survival"],
  "Mage": ["Arcane", "Fire", "Frost"],
  "Paladin": ["Holy", "Protection", "Retribution"],
  "Priest": ["Discipline", "Holy", "Shadow"],
  "Rogue": ["Assassination", "Combat", "Subtlety"],
  "Shaman": ["Elemental", "Enhancement", "Restoration"],
  "Warlock": ["Affliction", "Demonology", "Destruction"],
  "Warrior": ["Arms", "Fury", "Protection"]
}

const AURAS_ICONS = {
  "1604": "spell_frost_stun",
  "2825": "spell_nature_bloodlust",
  "10060": "spell_holy_powerinfusion",
  "19753": "spell_nature_timestop",
  "23060": "inv_misc_birdbeck_01",
  "28494": "inv_potion_109",
  "28507": "inv_potion_108",
  "28714": "inv_misc_herb_flamecap",
  "29166": "spell_nature_lightning",
  "32182": "ability_shaman_heroism",
  "49016": "spell_deathknight_bladedarmor",
  "51800": "inv_misc_head_dragon_blue",
  "53762": "inv_alchemy_elixir_empty",
  "53908": "inv_alchemy_elixir_04",
  "53909": "inv_alchemy_elixir_01",
  "54646": "spell_arcane_studentofmagic",
  "54758": "spell_shaman_elementaloath",
  "57933": "ability_rogue_tricksofthetrade",
  "63848": "ability_rogue_hungerforblood",
  "66283": "spell_shadow_shadowmend",
  "67108": "ability_mage_netherwindpresence",
  "67215": "spell_shadow_darkritual",
  "67218": "spell_holy_searinglightpriest",
  "67907": "spell_shadow_soothingkiss",
  "68125": "spell_fire_felimmolation",
  "69065": "inv_misc_bone_03",
  "69279": "spell_shadow_creepingplague",
  "69762": "spell_arcane_focusedpower",
  "70157": "spell_frost_frozencore",
  "71237": "ability_creature_cursed_03",
  "71265": "ability_rogue_shadowdance",
  "71289": "inv_belt_18",
  "71340": "spell_shadow_destructivesoul",
  "71531": "ability_warlock_improvedsoulleech",
  "72550": "inv_misc_herb_evergreenmoss",
  "72553": "achievement_boss_festergutrotface",
  "72620": "ability_creature_cursed_01",
  "72833": "spell_holiday_tow_spicecloud",
  "72838": "ability_warlock_chaosbolt",
  "72856": "spell_shadow_corpseexplode",
  "73020": "ability_creature_cursed_01",
  "73023": "ability_creature_disease_02",
  "74118": "inv_inscription_inkgreen03",
  "74119": "inv_inscription_inkorange01",
  "74297": "spell_deathknight_strangulate",
  "74384": "ability_golemthunderclap",
  "74456": "inv_misc_orb_05",
  "74509": "spell_fire_playingwithfire",
  "74531": "ability_criticalstrike",
  "74567": "spell_fire_sealoffire",
  "74795": "spell_shadow_sealofkings"
}

export {
  BOSSES,
  CLASSES,
  SPECS,
  SPECS_SELECT_OPTIONS,
  AURAS_COLUMNS,
  DATA_KEYS,
  AURAS_ICONS,
  LOGS_URL,
  ICON_CDN_URL,
  MONTHS,
}