<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEEDRUN_RAIDS = [
  "Icecrown Citadel",
  "Trial of the Crusader",
  "Ulduar",
  "Naxxramas",
]

const BOSSES: Record<string, string[]> = {
  "Points":   [],
  "Speedrun": SPEEDRUN_RAIDS,
  "Icecrown Citadel": [
    "The Lich King", "Lord Marrowgar", "Lady Deathwhisper", "Deathbringer Saurfang",
    "Festergut", "Rotface", "Professor Putricide",
    "Blood Prince Council", "Blood-Queen Lana'thel",
    "Valithria Dreamwalker", "Sindragosa",
  ],
  "The Ruby Sanctum": ["Halion", "Baltharus the Warborn", "Saviana Ragefire", "General Zarithrian"],
  "Trial of the Crusader": ["Anub'arak", "Northrend Beasts", "Lord Jaraxxus", "Faction Champions", "Twin Val'kyr"],
  "Vault of Archavon": ["Toravon the Ice Watcher", "Archavon the Stone Watcher", "Emalon the Storm Watcher", "Koralon the Flame Watcher"],
  "Onyxia's Lair": ["Onyxia"],
  "The Obsidian Sanctum": ["Sartharion"],
  "Ulduar": [
    "Ignis the Furnace Master", "Razorscale", "XT-002 Deconstructor",
    "Assembly of Iron", "Kologarn", "Auriaya", "Hodir", "Thorim", "Freya", "Mimiron",
    "General Vezax", "Yogg-Saron", "Algalon the Observer",
  ],
  "Naxxramas": [
    "Anub'Rekhan", "Grand Widow Faerlina", "Maexxna",
    "Noth the Plaguebringer", "Heigan the Unclean", "Loatheb",
    "Patchwerk", "Grobbulus", "Gluth", "Thaddius",
    "Instructor Razuvious", "Gothik the Harvester", "The Four Horsemen",
    "Sapphiron", "Kel'Thuzad",
  ],
}

const CLASSES = ["Death Knight", "Druid", "Hunter", "Mage", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"]

const SPECS_BY_CLASS: Record<string, string[]> = {
  "Death Knight": ["Blood", "Frost", "Unholy"],
  "Druid":        ["Balance", "Feral Combat", "Restoration"],
  "Hunter":       ["Beast Mastery", "Marksmanship", "Survival"],
  "Mage":         ["Arcane", "Fire", "Frost"],
  "Paladin":      ["Holy", "Protection", "Retribution"],
  "Priest":       ["Discipline", "Holy", "Shadow"],
  "Rogue":        ["Assassination", "Combat", "Subtlety"],
  "Shaman":       ["Elemental", "Enhancement", "Restoration"],
  "Warlock":      ["Affliction", "Demonology", "Destruction"],
  "Warrior":      ["Arms", "Fury", "Protection"],
}

const SPECS: [string, string, string][] = [
  ["Death Knight", "class_deathknight",               "death-knight"],
  ["Blood",        "spell_deathknight_bloodpresence",  "death-knight"],
  ["Frost",        "spell_deathknight_frostpresence",  "death-knight"],
  ["Unholy",       "spell_deathknight_unholypresence", "death-knight"],
  ["Druid",        "class_druid",                      "druid"],
  ["Balance",      "spell_nature_starfall",             "druid"],
  ["Feral Combat", "ability_racial_bearform",           "druid"],
  ["Restoration",  "spell_nature_healingtouch",         "druid"],
  ["Hunter",       "class_hunter",                     "hunter"],
  ["Beast Mastery","ability_hunter_beasttaming",        "hunter"],
  ["Marksmanship", "ability_marksmanship",              "hunter"],
  ["Survival",     "ability_hunter_swiftstrike",        "hunter"],
  ["Mage",         "class_mage",                       "mage"],
  ["Arcane",       "spell_holy_magicalsentry",          "mage"],
  ["Fire",         "spell_fire_firebolt02",             "mage"],
  ["Frost",        "spell_frost_frostbolt02",           "mage"],
  ["Paladin",      "class_paladin",                    "paladin"],
  ["Holy",         "spell_holy_holybolt",               "paladin"],
  ["Protection",   "spell_holy_devotionaura",           "paladin"],
  ["Retribution",  "spell_holy_auraoflight",            "paladin"],
  ["Priest",       "class_priest",                     "priest"],
  ["Discipline",   "spell_holy_wordfortitude",          "priest"],
  ["Holy",         "spell_holy_guardianspirit",         "priest"],
  ["Shadow",       "spell_shadow_shadowwordpain",       "priest"],
  ["Rogue",        "class_rogue",                      "rogue"],
  ["Assassination","ability_rogue_eviscerate",          "rogue"],
  ["Combat",       "ability_backstab",                  "rogue"],
  ["Subtlety",     "ability_stealth",                   "rogue"],
  ["Shaman",       "class_shaman",                     "shaman"],
  ["Elemental",    "spell_nature_lightning",            "shaman"],
  ["Enhancement",  "spell_nature_lightningshield",      "shaman"],
  ["Restoration",  "spell_nature_magicimmunity",        "shaman"],
  ["Warlock",      "class_warlock",                    "warlock"],
  ["Affliction",   "spell_shadow_deathcoil",            "warlock"],
  ["Demonology",   "spell_shadow_metamorphosis",        "warlock"],
  ["Destruction",  "spell_shadow_rainoffire",           "warlock"],
  ["Warrior",      "class_warrior",                    "warrior"],
  ["Arms",         "ability_warrior_savageblow",        "warrior"],
  ["Fury",         "ability_warrior_innerrage",         "warrior"],
  ["Protection",   "ability_warrior_defensivestance",   "warrior"],
]

// Default spec per class (index = class_i, value = spec_i 1-3)
const DEFAULT_SPEC = [3, 1, 2, 2, 3, 3, 2, 1, 2, 2]

const RAID_WITH_HEROIC = new Set(["Icecrown Citadel", "Trial of the Crusader"])
const BOSS_WITH_HEROIC = new Set([
  "Halion",
  "XT-002 Deconstructor", "Assembly of Iron", "Freya", "Thorim", "Mimiron",
  "General Vezax", "Yogg-Saron",
])

const RANK_THRESHOLDS = [100, 99, 95, 90, 75, 50, 25, 0]

const FACTION_ICONS: Record<number, string> = {
  0: '/static/alliance.png',
  1: '/static/horde.png',
}

const DPS_SORT_COLS = ["head-useful-dps", "head-useful-amount", "head-total-dps", "head-total-amount", "head-duration", "head-date"]
const SPEEDRUN_SORT_COLS = ["head-speedrun-total-length", "head-speedrun-segments-sum"]

const LS = {
  server:    'top_server',
  instance:  'top_raid',
  boss:      'top_boss',
  cls:       'top_class',
  spec:      'top_spec',
  size:      'top_size',
  heroic:    'top_heroic',
  bestOnly:  'top_best',
  showUseful:'top_useful',
  showTotal: 'top_total',
  limit1000: 'top_limit',
  externals: 'top_externals',
}

// ── State ─────────────────────────────────────────────────────────────────────

const servers     = ref<string[]>([])
const selServer   = ref('')
const selInstance = ref('Icecrown Citadel')
const selBoss     = ref('')
const selSize     = ref('25')
const heroic      = ref(false)
const selClass    = ref(-1)   // -1 = All
const selSpec     = ref(-1)   // -1 = All
const bestOnly    = ref(true)
const showUseful  = ref(true)
const showTotal   = ref(false)
const limit1000   = ref(true)
const externals   = ref(true)

const loading = ref(false)
const error   = ref('')
const rows    = ref<any[][]>([])

const dpsSortCol      = ref('head-useful-dps')
const speedrunSortCol = ref('head-speedrun-total-length')

// Aura tooltip
const auraIcons     = ref<Record<string, string>>({})
const tooltipAuras  = ref<[number, number, number][]>([])
const tooltipVisible = ref(false)
const tooltipTop    = ref(0)
const tooltipRight  = ref(0)
let tooltipHideTimer: ReturnType<typeof setTimeout> | null = null

// Request dedup / cache
const reqCache = new Map<string, any[]>()
let   abortCtrl: AbortController | null = null

// ── Computed ──────────────────────────────────────────────────────────────────

const mode = computed<'dps' | 'points' | 'speedrun'>(() => {
  if (selInstance.value === 'Points')   return 'points'
  if (selInstance.value === 'Speedrun') return 'speedrun'
  return 'dps'
})

const bossList = computed(() => BOSSES[selInstance.value] ?? [])

const specList = computed(() =>
  selClass.value >= 0 ? (SPECS_BY_CLASS[CLASSES[selClass.value]] ?? []) : []
)

const hasHeroic = computed(() =>
  RAID_WITH_HEROIC.has(selInstance.value) || BOSS_WITH_HEROIC.has(selBoss.value)
)

const difficulty = computed(() =>
  `${selSize.value}${hasHeroic.value && heroic.value ? 'H' : 'N'}`
)

const queryKey = computed(() => {
  if (mode.value === 'dps') {
    return JSON.stringify({
      t: 'dps', server: selServer.value, boss: selBoss.value,
      mode: difficulty.value, class_i: selClass.value, spec_i: selSpec.value,
      best_only: bestOnly.value, sort_by: dpsSortCol.value,
      limit: limit1000.value ? 1000 : 10000, externals: externals.value,
    })
  }
  if (mode.value === 'points') {
    return JSON.stringify({
      t: 'points', server: selServer.value,
      class_i: selClass.value, spec_i: selSpec.value,
      limit: limit1000.value ? 1000 : 10000,
    })
  }
  return JSON.stringify({
    t: 'speedrun', server: selServer.value, raid: selBoss.value,
    sort_by: speedrunSortCol.value,
  })
})

// ── Watchers ──────────────────────────────────────────────────────────────────

watch(selInstance, () => {
  rows.value = []
  selBoss.value = bossList.value[0] ?? ''
  if (mode.value === 'points') {
    if (selClass.value < 0) selClass.value = 0
    if (selSpec.value  < 1) selSpec.value  = DEFAULT_SPEC[selClass.value]
  }
  if (!hasHeroic.value) heroic.value = false
  saveStorage()
})

watch(selClass, () => {
  selSpec.value = -1
  if (mode.value === 'points') {
    if (selClass.value < 0) selClass.value = 0
    selSpec.value = DEFAULT_SPEC[selClass.value]
  }
  saveStorage()
})

watch(selBoss, () => {
  if (!hasHeroic.value) heroic.value = false
})

watch(queryKey, () => {
  if (selServer.value) fetchRankings()
})

// ── Storage ───────────────────────────────────────────────────────────────────

function saveStorage() {
  try {
    localStorage.setItem(LS.server,    selServer.value)
    localStorage.setItem(LS.instance,  selInstance.value)
    localStorage.setItem(LS.boss,      selBoss.value)
    localStorage.setItem(LS.cls,       String(selClass.value))
    localStorage.setItem(LS.spec,      String(selSpec.value))
    localStorage.setItem(LS.size,      selSize.value)
    localStorage.setItem(LS.heroic,    heroic.value ? '1' : '0')
    localStorage.setItem(LS.bestOnly,  bestOnly.value ? '1' : '0')
    localStorage.setItem(LS.showUseful,showUseful.value ? '1' : '0')
    localStorage.setItem(LS.showTotal, showTotal.value ? '1' : '0')
    localStorage.setItem(LS.limit1000, limit1000.value ? '1' : '0')
    localStorage.setItem(LS.externals, externals.value ? '1' : '0')
  } catch {}
}

function loadStorage() {
  try {
    const sv = localStorage.getItem(LS.server)
    const inst = localStorage.getItem(LS.instance) ?? 'Icecrown Citadel'
    selInstance.value = Object.keys(BOSSES).includes(inst) ? inst : 'Icecrown Citadel'
    selBoss.value = localStorage.getItem(LS.boss) ?? bossList.value[0] ?? ''
    if (!bossList.value.includes(selBoss.value)) selBoss.value = bossList.value[0] ?? ''
    selClass.value = parseInt(localStorage.getItem(LS.cls) ?? '-1')
    selSpec.value  = parseInt(localStorage.getItem(LS.spec) ?? '-1')
    selSize.value  = localStorage.getItem(LS.size) ?? '25'
    heroic.value   = localStorage.getItem(LS.heroic) === '1'
    bestOnly.value = localStorage.getItem(LS.bestOnly) !== '0'
    showUseful.value = localStorage.getItem(LS.showUseful) !== '0'
    showTotal.value  = localStorage.getItem(LS.total) === '1'
    limit1000.value  = localStorage.getItem(LS.limit1000) !== '0'
    externals.value  = localStorage.getItem(LS.externals) !== '0'
    if (sv) selServer.value = sv
  } catch {}
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchServers() {
  try {
    const res = await fetch('/api/v2/servers/')
    servers.value = await res.json()
    if (!selServer.value || !servers.value.includes(selServer.value)) {
      selServer.value = servers.value.includes('Lordaeron')
        ? 'Lordaeron' : servers.value[0] ?? ''
    }
  } catch {}
}

async function fetchRankings() {
  const key = queryKey.value
  if (!selServer.value) return
  if (mode.value === 'dps' && !selBoss.value) return
  if (mode.value === 'points' && (selClass.value < 0 || selSpec.value < 1)) return

  // Cache hit
  if (reqCache.has(key)) {
    rows.value = reqCache.get(key)!
    error.value = ''
    return
  }

  abortCtrl?.abort()
  abortCtrl = new AbortController()

  loading.value = true
  error.value   = ''
  rows.value    = []

  try {
    let url: string
    let body: object

    if (mode.value === 'dps') {
      url  = '/top'
      body = {
        server: selServer.value, boss: selBoss.value, mode: difficulty.value,
        class_i: selClass.value, spec_i: selSpec.value,
        sort_by: dpsSortCol.value, limit: limit1000.value ? 1000 : 10000,
        best_only: bestOnly.value, externals: externals.value,
      }
    } else if (mode.value === 'points') {
      url  = '/top_points'
      body = { server: selServer.value, class_i: selClass.value, spec_i: selSpec.value }
    } else {
      url  = '/top_speedrun'
      body = { server: selServer.value, raid: selBoss.value, sort_by: speedrunSortCol.value }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abortCtrl.signal,
    })

    if (!res.ok) {
      const txt = await res.text()
      error.value = `Error ${res.status}: ${txt}`
      return
    }

    const data = await res.json()
    const parsed: any[][] = Array.isArray(data) ? data : []
    reqCache.set(key, parsed)
    rows.value = parsed
  } catch (e: any) {
    if (e?.name !== 'AbortError') error.value = e?.message ?? 'Unknown error'
  } finally {
    loading.value = false
  }
}

// ── Sorting ───────────────────────────────────────────────────────────────────

function sortDps(col: string) {
  if (!DPS_SORT_COLS.includes(col)) return
  dpsSortCol.value = col
  reqCache.delete(queryKey.value)  // force re-fetch with new sort
  saveStorage()
}

function sortSpeedrun(col: string) {
  if (!SPEEDRUN_SORT_COLS.includes(col)) return
  speedrunSortCol.value = col
  reqCache.delete(queryKey.value)
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function fmtDps(amount: number, dur: number): string {
  return (amount / (dur || 1)).toFixed(1)
}

function pad2(v: number): string {
  return v.toString().padStart(2, '0')
}

function fmtDuration(sec: number): string {
  return `${pad2(Math.floor(sec / 60))}:${pad2(Math.floor(sec % 60))}`
}

function fmtDurationHours(sec: number): string {
  return `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor(sec / 60 % 60))}:${pad2(Math.floor(sec % 60))}`
}

function fmtDate(reportId: string): string {
  const parts = String(reportId).slice(0, 15).split('-')
  if (parts.length < 3) return String(reportId)
  const [yy, mm, dd] = parts
  return `${dd} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(mm)-1] ?? mm} 20${yy}`
}

function reportLink(reportId: string): string {
  const bossSlug = selBoss.value.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '')
  return `/reports/${reportId}--${selServer.value}/?boss=${bossSlug}&mode=${difficulty.value}&attempt=kill`
}

// ── Spec helpers ──────────────────────────────────────────────────────────────

function specEntry(idx: number): [string, string, string] {
  return SPECS[idx] ?? ['', '', '']
}

function specIconSrc(idx: number): string {
  return `/static/icons/${specEntry(idx)[1]}.jpg`
}

function specClassSlug(idx: number): string {
  return specEntry(idx)[2]
}

function specLabel(idx: number): string {
  const [name] = specEntry(idx)
  const offset = idx % 4
  if (offset === 0) return name
  const [className] = specEntry(idx - offset)
  return `${className} ${name}`
}

function charLink(name: string, spec: number): string {
  return `/character?name=${name}&server=${selServer.value}&spec=${spec % 4}`
}

// ── Rank class ────────────────────────────────────────────────────────────────

function rankClass(pct: number): string {
  for (const t of RANK_THRESHOLDS) if (pct >= t) return `top${t}`
  return 'top0'
}

// ── Auras ─────────────────────────────────────────────────────────────────────

// Returns sum count for auras of given type (0=Ext,1=Self,2=Rekt,3=Cls)
function auraCount(auras: [number, number, number, number][], type: number): number {
  return auras.filter(a => a[3] === type).reduce((s, a) => s + a[1], 0)
}

function aurasByType(auras: [number, number, number, number][], type: number) {
  return auras.filter(a => a[3] === type)
}

function onAuraEnter(event: MouseEvent, auras: [number, number, number, number][], type: number) {
  clearTimeout(tooltipHideTimer!)
  tooltipAuras.value = aurasByType(auras, type)
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  tooltipTop.value   = rect.bottom + window.scrollY
  tooltipRight.value = document.body.clientWidth - rect.left
  tooltipVisible.value = true
}

function onAuraLeave() {
  tooltipHideTimer = setTimeout(() => { tooltipVisible.value = false }, 300)
}

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(async () => {
  // Load aura icons
  try {
    auraIcons.value = await fetch('/static/aura_icons.json').then(r => r.json())
  } catch {}

  loadStorage()
  await fetchServers()
  await nextTick()
  if (selServer.value) fetchRankings()
})

// Points spec: full index = class_i * 4 + spec_i
const pointsSpecIndex = computed(() => selClass.value * 4 + selSpec.value)
</script>

<template>
  <div class="rankings-page">
    <div class="rankings-inner">
      <h1 class="page-title">Top</h1>

      <!-- ── Controls ──────────────────────────────────────────────────── -->
      <div class="controls" v-if="servers.length">
        <div class="ctrl-row ctrl-primary">
          <!-- Server -->
          <select v-model="selServer" class="ctrl-sel" @change="saveStorage">
            <option v-for="s in servers" :key="s" :value="s">{{ s }}</option>
          </select>

          <!-- Instance / Mode -->
          <select v-model="selInstance" class="ctrl-sel" @change="saveStorage">
            <option v-for="inst in Object.keys(BOSSES)" :key="inst" :value="inst">{{ inst }}</option>
          </select>

          <!-- Boss / Raid selector -->
          <select
            v-model="selBoss"
            class="ctrl-sel"
            :disabled="mode === 'points'"
            @change="saveStorage"
          >
            <option v-for="b in bossList" :key="b" :value="b">{{ b }}</option>
          </select>

          <!-- Size (DPS only) -->
          <select
            v-model="selSize"
            class="ctrl-sel ctrl-sm"
            :disabled="mode !== 'dps'"
            @change="saveStorage"
          >
            <option value="25">25</option>
            <option value="10">10</option>
          </select>

          <!-- Heroic checkbox -->
          <label class="ctrl-check" :class="{ disabled: !hasHeroic || mode !== 'dps' }">
            <input
              type="checkbox"
              v-model="heroic"
              :disabled="!hasHeroic || mode !== 'dps'"
              @change="saveStorage"
            />
            Heroic
          </label>

          <!-- Class -->
          <select
            v-model.number="selClass"
            class="ctrl-sel"
            :disabled="mode === 'speedrun'"
            @change="saveStorage"
          >
            <option v-if="mode !== 'points'" :value="-1">All classes</option>
            <option v-for="(cls, i) in CLASSES" :key="i" :value="i">{{ cls }}</option>
          </select>

          <!-- Spec -->
          <select
            v-model.number="selSpec"
            class="ctrl-sel"
            :disabled="mode === 'speedrun' || selClass < 0"
            @change="saveStorage"
          >
            <option v-if="mode !== 'points'" :value="-1">All specs</option>
            <option
              v-for="(sp, i) in specList"
              :key="i"
              :value="i + 1"
            >{{ sp }}</option>
          </select>
        </div>

        <div class="ctrl-row ctrl-toggles">
          <label class="ctrl-check" :class="{ disabled: mode !== 'dps' }">
            <input type="checkbox" v-model="bestOnly" :disabled="mode !== 'dps'" @change="saveStorage" />
            Best
          </label>
          <label class="ctrl-check">
            <input type="checkbox" v-model="showUseful" @change="saveStorage" />
            Show useful
          </label>
          <label class="ctrl-check">
            <input type="checkbox" v-model="showTotal" @change="saveStorage" />
            Show total
          </label>
          <label class="ctrl-check">
            <input type="checkbox" v-model="limit1000" @change="saveStorage" />
            Limit 1000
          </label>
          <label class="ctrl-check" :class="{ disabled: mode !== 'dps' }">
            <input type="checkbox" v-model="externals" :disabled="mode !== 'dps'" @change="saveStorage" />
            Externals
          </label>
        </div>
      </div>

      <!-- ── Status ────────────────────────────────────────────────────── -->
      <div v-if="loading" class="status-msg">Loading…</div>
      <div v-else-if="error" class="status-msg err">{{ error }}</div>
      <div v-else-if="!loading && !rows.length && servers.length" class="status-msg">No data</div>

      <!-- ── DPS Table ─────────────────────────────────────────────────── -->
      <table v-if="mode === 'dps' && rows.length" class="top-table">
        <thead>
          <tr>
            <th class="col-n">Name</th>
            <th
              v-if="showUseful"
              id="head-useful-dps"
              class="col-dps col-u sortable"
              :class="{ sorted: dpsSortCol === 'head-useful-dps' }"
              @click="sortDps('head-useful-dps')"
            >uDPS</th>
            <th
              v-if="showUseful"
              id="head-useful-amount"
              class="col-amt col-u sortable"
              :class="{ sorted: dpsSortCol === 'head-useful-amount' }"
              @click="sortDps('head-useful-amount')"
            >Useful</th>
            <th
              v-if="showTotal"
              id="head-total-dps"
              class="col-dps col-d sortable"
              :class="{ sorted: dpsSortCol === 'head-total-dps' }"
              @click="sortDps('head-total-dps')"
            >tDPS</th>
            <th
              v-if="showTotal"
              id="head-total-amount"
              class="col-amt col-d sortable"
              :class="{ sorted: dpsSortCol === 'head-total-amount' }"
              @click="sortDps('head-total-amount')"
            >Total</th>
            <th
              id="head-duration"
              class="col-dur sortable"
              :class="{ sorted: dpsSortCol === 'head-duration' }"
              @click="sortDps('head-duration')"
            >Dur</th>
            <th class="col-aura">E</th>
            <th class="col-aura">S</th>
            <th class="col-aura">R</th>
            <th class="col-aura">C</th>
            <th
              id="head-date"
              class="col-date sortable"
              :class="{ sorted: dpsSortCol === 'head-date' }"
              @click="sortDps('head-date')"
            >Date</th>
          </tr>
        </thead>
        <tbody>
          <!-- row: [report_ID, duration, guid, name, uAmount, tAmount, spec, auras] -->
          <tr v-for="(row, i) in rows" :key="i" class="data-row">
            <td class="col-n">
              <img class="spec-icon" :src="specIconSrc(row[6])" :alt="specLabel(row[6])" width="16" height="16" />
              <a :href="charLink(row[3], row[6])" :class="`cls-${specClassSlug(row[6])}`" target="_blank">{{ row[3] }}</a>
            </td>
            <td v-if="showUseful" class="col-dps col-u">{{ fmtDps(row[4], row[1]) }}</td>
            <td v-if="showUseful" class="col-amt col-u">{{ fmtNum(row[4]) }}</td>
            <td v-if="showTotal"  class="col-dps col-d">{{ fmtDps(row[5], row[1]) }}</td>
            <td v-if="showTotal"  class="col-amt col-d">{{ fmtNum(row[5]) }}</td>
            <td class="col-dur">{{ fmtDuration(row[1]) }}</td>
            <!-- Aura columns: External(0), Self(1), Rekt(2), Class(3) -->
            <template v-for="auraType in [0, 1, 2, 3]" :key="auraType">
              <td
                class="col-aura"
                :class="{ 'has-aura': auraCount(row[7], auraType) > 0 }"
                @mouseenter="auraCount(row[7], auraType) > 0 && onAuraEnter($event, row[7], auraType)"
                @mouseleave="onAuraLeave"
              >{{ auraCount(row[7], auraType) || '' }}</td>
            </template>
            <td class="col-date">
              <a :href="reportLink(row[0])" target="_blank">{{ fmtDate(row[0]) }}</a>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- ── Points Table ──────────────────────────────────────────────── -->
      <table v-else-if="mode === 'points' && rows.length" class="top-table">
        <thead>
          <tr>
            <th class="col-rank">#</th>
            <th class="col-n">Name</th>
            <th class="col-pts" title="Score relative to rank 1 (100 = best)">Score</th>
            <th class="col-pts" title="Total accumulated points">Points</th>
          </tr>
        </thead>
        <tbody>
          <!-- row: [name, p_relative, p_total] -->
          <tr v-for="(row, i) in rows" :key="i" class="data-row">
            <td class="col-rank">{{ i + 1 }}</td>
            <td class="col-n">
              <img
                class="spec-icon"
                :src="specIconSrc(pointsSpecIndex)"
                :alt="specLabel(pointsSpecIndex)"
                width="16" height="16"
              />
              <a
                :href="charLink(row[0], pointsSpecIndex)"
                :class="`cls-${specClassSlug(pointsSpecIndex)}`"
                target="_blank"
              >{{ row[0] }}</a>
            </td>
            <td class="col-pts" :class="isFinite(row[1]) ? rankClass(row[1]) : ''">
              {{ isFinite(row[1]) ? Number(row[1]).toFixed(2) : '—' }}
            </td>
            <td class="col-pts">{{ isFinite(row[2]) ? fmtNum(row[2]) : '—' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- ── Speedrun Table ─────────────────────────────────────────────── -->
      <table v-else-if="mode === 'speedrun' && rows.length" class="top-table speedrun-table">
        <thead>
          <tr>
            <th class="col-n" colspan="2">Guild</th>
            <th
              id="head-speedrun-total-length"
              class="col-dur sortable"
              :class="{ sorted: speedrunSortCol === 'head-speedrun-total-length' }"
              @click="sortSpeedrun('head-speedrun-total-length')"
            >Total</th>
            <th
              id="head-speedrun-segments-sum"
              class="col-dur sortable"
              :class="{ sorted: speedrunSortCol === 'head-speedrun-segments-sum' }"
              @click="sortSpeedrun('head-speedrun-segments-sum')"
            >Segments</th>
            <th class="col-date">Date</th>
          </tr>
        </thead>
        <tbody>
          <!-- row: [report_id, total_length, segments_sum, guild_name, faction] -->
          <tr v-for="(row, i) in rows" :key="i" class="data-row">
            <td class="col-faction">
              <img
                v-if="FACTION_ICONS[row[4]] != null"
                :src="FACTION_ICONS[row[4]]"
                width="16" height="16"
                :alt="row[4] === 0 ? 'Alliance' : 'Horde'"
              />
            </td>
            <td class="col-guild">{{ row[3] }}</td>
            <td class="col-dur">{{ fmtDurationHours(row[1]) }}</td>
            <td class="col-dur">{{ fmtDurationHours(row[2]) }}</td>
            <td class="col-date">
              <a :href="`/reports/${row[0]}--${selServer}`" target="_blank">{{ fmtDate(row[0]) }}</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Aura Tooltip ───────────────────────────────────────────────── -->
    <aside
      class="aura-tooltip"
      v-show="tooltipVisible"
      :style="{ top: tooltipTop + 'px', right: tooltipRight + 'px' }"
      @mouseenter="clearTimeout(tooltipHideTimer!)"
      @mouseleave="onAuraLeave"
    >
      <table>
        <tbody>
          <tr v-for="([spellId, count, uptime]) in tooltipAuras" :key="spellId">
            <td>
              <img
                :src="`/static/icons/${auraIcons[spellId] ?? 'undefined'}.jpg`"
                width="18" height="18"
                :alt="String(spellId)"
              />
            </td>
            <td class="tip-count">{{ count }}</td>
            <td class="tip-uptime">{{ Number(uptime).toFixed(1) }}%</td>
          </tr>
        </tbody>
      </table>
    </aside>
  </div>
</template>

<style scoped>
.rankings-page {
  min-height: calc(100vh - var(--nav-height));
  padding: 2rem 1rem;
  display: flex;
  justify-content: center;
}

.rankings-inner {
  width: 100%;
  max-width: 1100px;
}

.page-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  margin: 0 0 1.25rem;
}

/* ── Controls ─────────────────────────────────────────────────────────── */
.controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 1.25rem;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid hsl(271, 20%, 14%);
}

.ctrl-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ctrl-sel {
  background: var(--bg);
  border: 1px solid hsl(271, 20%, 20%);
  color: var(--text);
  font-size: 0.8125rem;
  padding: 3px 6px;
  height: 28px;
  min-width: 130px;
}

.ctrl-sel.ctrl-sm {
  min-width: 60px;
}

.ctrl-sel:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ctrl-check {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8125rem;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.ctrl-check input[type="checkbox"] { accent-color: var(--primary); }
.ctrl-check.disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Status ─────────────────────────────────────────────────────────────── */
.status-msg {
  color: var(--text-muted);
  font-size: 0.875rem;
  padding: 0.5rem 0;
}
.status-msg.err { color: #e05a5a; }

/* ── Table ──────────────────────────────────────────────────────────────── */
.top-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.top-table th {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: left;
  padding: 0 6px 6px;
  border-bottom: 1px solid var(--table-border);
  white-space: nowrap;
}

.top-table th.sortable { cursor: pointer; }
.top-table th.sortable:hover { color: var(--text); }
.top-table th.sorted { color: var(--primary-bright); }

.data-row {
  border-bottom: 1px solid var(--table-border);
}
.data-row:hover { background: var(--hover-row); }
.data-row td {
  padding: 0 6px;
  height: 36px;
  white-space: nowrap;
}

/* ── Column widths ─────────────────────────────────────────────────────── */
.col-n {
  min-width: 160px;
  max-width: 240px;
  overflow: hidden;
}

.col-n img.spec-icon {
  vertical-align: middle;
  border-radius: 2px;
  margin-right: 5px;
  flex-shrink: 0;
}

.col-n a {
  text-decoration: none;
  color: var(--text);
  vertical-align: middle;
}
.col-n a:hover { color: var(--primary-bright); }

.col-dps, .col-amt, .col-dur, .col-date, .col-pts {
  text-align: right;
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 0.875rem;
}

.col-dps  { width: 80px; }
.col-amt  { width: 100px; }
.col-dur  { width: 70px; }
.col-date { width: 110px; color: var(--text-muted); }
.col-pts  { width: 80px; }

.col-date a { color: var(--text-muted); text-decoration: none; }
.col-date a:hover { color: var(--primary-bright); }

.col-aura {
  width: 32px;
  text-align: center;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.col-aura.has-aura {
  cursor: pointer;
  color: var(--text);
}

.col-rank {
  width: 36px;
  text-align: right;
  font-family: 'Barlow Condensed', sans-serif;
  font-variant-numeric: tabular-nums;
  font-size: 0.8rem;
  color: var(--text-muted);
  padding-right: 8px !important;
}

.col-faction { width: 20px; padding-right: 0 !important; }
.col-faction img { vertical-align: middle; }
.col-guild { padding-left: 4px !important; }

/* ── Rank colors ────────────────────────────────────────────────────────── */
.top100 { color: #e5cc80; }
.top99  { color: #e268a8; }
.top95  { color: #ff8000; }
.top90  { color: #ff3c00; }
.top75  { color: #a335ee; }
.top50  { color: #0070ff; }
.top25  { color: #1eff00; }
.top0   { color: #9d9d9d; }

/* ── Class colors ───────────────────────────────────────────────────────── */
.cls-death-knight { color: #C41E3A; }
.cls-druid        { color: #FF7C0A; }
.cls-hunter       { color: #AAD372; }
.cls-mage         { color: #3FC7EB; }
.cls-paladin      { color: #F48CBA; }
.cls-priest       { color: #FFFFFF; }
.cls-rogue        { color: #FFF468; }
.cls-shaman       { color: #0070DD; }
.cls-warlock      { color: #8788EE; }
.cls-warrior      { color: #C69B3A; }

/* ── Aura tooltip ───────────────────────────────────────────────────────── */
.aura-tooltip {
  position: absolute;
  z-index: 100;
  background: hsl(271, 25%, 10%);
  border: 1px solid hsl(271, 20%, 25%);
  padding: 6px;
  pointer-events: none;
}

.aura-tooltip table {
  border-collapse: collapse;
}

.aura-tooltip td {
  padding: 2px 4px;
  vertical-align: middle;
  font-size: 0.8125rem;
}

.aura-tooltip img {
  display: block;
  border-radius: 2px;
}

.tip-count  { text-align: right; color: var(--text); }
.tip-uptime { text-align: right; color: var(--text-muted); min-width: 50px; }
</style>
