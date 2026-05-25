<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// ── Constants (mirrored from static/constants.js) ─────────────────────────────

const BOSSES: Record<string, string[]> = {
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
  "The Eye of Eternity": ["Malygos"],
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
  "Druid": ["Balance", "Feral Combat", "Restoration"],
  "Hunter": ["Beast Mastery", "Marksmanship", "Survival"],
  "Mage": ["Arcane", "Fire", "Frost"],
  "Paladin": ["Holy", "Protection", "Retribution"],
  "Priest": ["Discipline", "Holy", "Shadow"],
  "Rogue": ["Assassination", "Combat", "Subtlety"],
  "Shaman": ["Elemental", "Enhancement", "Restoration"],
  "Warlock": ["Affliction", "Demonology", "Destruction"],
  "Warrior": ["Arms", "Fury", "Protection"],
}

const CLASS_TO_INDEX: Record<string, number> = Object.fromEntries(CLASSES.map((c, i) => [c, i]))

// Mirrors static/constants.js SPECS: [name, icon_slug, class_slug] indexed 0–39
// Each class occupies 4 slots: [ClassName, Spec1, Spec2, Spec3]
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

const MODES = ["25H", "25N", "10H", "10N"]

// ── State ─────────────────────────────────────────────────────────────────────

const DEFAULT_RAID = Object.keys(BOSSES)[0]
const DEFAULT_BOSS = BOSSES[DEFAULT_RAID][0]

function qStr(key: string, fallback: string): string {
  const v = route.query[key]
  return (typeof v === 'string' && v) ? v : fallback
}
function qBool(key: string, fallback: boolean): boolean {
  const v = route.query[key]
  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false
  return fallback
}

const servers = ref<string[]>([])
const selectedServer = ref(qStr('server', ''))
const selectedRaid = ref(qStr('raid', DEFAULT_RAID))
const selectedBoss = ref(qStr('boss', DEFAULT_BOSS))
const selectedMode = ref(qStr('mode', '25H'))
const selectedClass = ref(qStr('class', 'All'))
const selectedSpec = ref(qStr('spec', 'All'))
const bestOnly = ref(qBool('best', true))
const showTotal = ref(qBool('total', false))

const loading = ref(false)
const error = ref('')
const rows = ref<any[][]>([])

const rebuilding = ref(false)
const rebuildMsg = ref('')
let pollTimer: ReturnType<typeof setTimeout> | null = null

async function triggerRebuild() {
  rebuilding.value = true
  rebuildMsg.value = 'Starting rankings build…'
  try {
    await fetch('/api/v2/rebuild_rankings/', { method: 'POST' })
    pollRebuild()
  } catch {
    rebuildMsg.value = 'Failed to start rebuild.'
    rebuilding.value = false
  }
}

async function pollRebuild() {
  try {
    const res = await fetch('/api/v2/rebuild_rankings/')
    const data = await res.json()
    if (data.running) {
      rebuildMsg.value = 'Building rankings… this may take a few minutes.'
      pollTimer = setTimeout(pollRebuild, 3000)
    } else {
      rebuildMsg.value = ''
      rebuilding.value = false
      await fetchServers()
      if (selectedServer.value) fetchRankings()
    }
  } catch {
    pollTimer = setTimeout(pollRebuild, 5000)
  }
}

// ── Derived ───────────────────────────────────────────────────────────────────

const bossList = computed(() => BOSSES[selectedRaid.value] ?? [])

const specList = computed(() => {
  if (selectedClass.value === 'All') return []
  return SPECS_BY_CLASS[selectedClass.value] ?? []
})

const classIndex = computed(() => {
  if (selectedClass.value === 'All') return -1
  return CLASS_TO_INDEX[selectedClass.value] ?? -1
})

const specIndex = computed(() => {
  if (selectedClass.value === 'All' || selectedSpec.value === 'All') return -1
  const specs = SPECS_BY_CLASS[selectedClass.value] ?? []
  const idx = specs.indexOf(selectedSpec.value)
  return idx === -1 ? -1 : idx + 1  // API expects 1, 2, 3 (not 0-based)
})

// ── Watchers ──────────────────────────────────────────────────────────────────

watch(selectedRaid, () => {
  selectedBoss.value = bossList.value[0] ?? ''
})

watch(selectedClass, () => {
  selectedSpec.value = 'All'
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchServers() {
  try {
    const res = await fetch('/api/v2/servers/')
    servers.value = await res.json()
    if (!selectedServer.value && servers.value.length) {
      selectedServer.value = servers.value.includes('Lordaeron') ? 'Lordaeron' : servers.value[0]
    }
  } catch {
    // ignore
  }
}

function pushUrl() {
  const q: Record<string, string> = {
    server: selectedServer.value,
    raid:   selectedRaid.value,
    boss:   selectedBoss.value,
    mode:   selectedMode.value,
  }
  if (selectedClass.value !== 'All') q.class = selectedClass.value
  if (selectedSpec.value  !== 'All') q.spec  = selectedSpec.value
  if (!bestOnly.value)  q.best  = '0'
  if (showTotal.value)  q.total = '1'
  router.replace({ query: q })
}

async function fetchRankings() {
  if (!selectedServer.value || !selectedBoss.value) return
  pushUrl()
  loading.value = true
  error.value = ''
  rows.value = []
  try {
    const res = await fetch('/top', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        server: selectedServer.value,
        boss: selectedBoss.value,
        mode: selectedMode.value,
        class_i: classIndex.value,
        spec_i: specIndex.value,
        sort_by: showTotal.value ? 'head-total-dps' : 'head-useful-dps',
        limit: 1000,
        best_only: bestOnly.value,
        externals: true,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      error.value = `Error ${res.status}: ${text}`
      return
    }
    const data = await res.json()
    rows.value = Array.isArray(data) ? data : []
  } catch (e: any) {
    error.value = e?.message ?? 'Unknown error'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchServers()
  if (selectedServer.value) fetchRankings()
})

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  return n.toLocaleString('en-US')
}

function fmtDps(amount: number, dur: number): string {
  return (amount / dur).toFixed(1)
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function fmtDate(reportId: string): string {
  // format: "YY-MM-DD--HH-MM--Author"
  const parts = reportId.split('--')
  if (!parts[0]) return reportId
  const [yy, mm, dd] = parts[0].split('-')
  return `20${yy}-${mm}-${dd}`
}

function specEntry(specIdx: number): [string, string, string] {
  return SPECS[specIdx] ?? ['', '', '']
}

function specLabel(specIdx: number): string {
  const [name, , classSlug] = specEntry(specIdx)
  const offset = specIdx % 4
  if (offset === 0) return name  // class row — shouldn't appear in results but safe fallback
  const [className] = specEntry(specIdx - offset)
  return `${className} ${name}`
}

function specIconSrc(specIdx: number): string {
  const [, icon] = specEntry(specIdx)
  return `/static/icons/${icon}.jpg`
}

function specClassSlug(specIdx: number): string {
  return specEntry(specIdx)[2]
}
</script>

<template>
  <div class="rankings-page">
    <div class="rankings-inner">
      <h1 class="page-title">Rankings</h1>

      <!-- No ranking data yet -->
      <div v-if="!servers.length && !rebuilding" class="no-data-panel">
        <p class="no-data-msg">No ranking data available yet.</p>
        <p class="no-data-sub">Rankings are built from uploaded logs. Click below to generate them from all currently indexed logs.</p>
        <button class="rebuild-btn" @click="triggerRebuild">Build Rankings</button>
      </div>

      <div v-if="rebuilding" class="rebuild-progress">
        <span class="rebuild-spinner" />
        <span>{{ rebuildMsg }}</span>
      </div>

      <!-- Filters -->
      <div class="filters" v-if="servers.length">
        <div class="filter-row">
          <label class="filter-label">Server</label>
          <select v-model="selectedServer" class="filter-select" @change="fetchRankings">
            <option v-for="s in servers" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div class="filter-row">
          <label class="filter-label">Raid</label>
          <select v-model="selectedRaid" class="filter-select">
            <option v-for="raid in Object.keys(BOSSES)" :key="raid" :value="raid">{{ raid }}</option>
          </select>
        </div>

        <div class="filter-row">
          <label class="filter-label">Boss</label>
          <select v-model="selectedBoss" class="filter-select">
            <option v-for="boss in bossList" :key="boss" :value="boss">{{ boss }}</option>
          </select>
        </div>

        <div class="filter-row">
          <label class="filter-label">Mode</label>
          <select v-model="selectedMode" class="filter-select">
            <option v-for="m in MODES" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>

        <div class="filter-row">
          <label class="filter-label">Class</label>
          <select v-model="selectedClass" class="filter-select">
            <option value="All">All classes</option>
            <option v-for="c in CLASSES" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="filter-row" v-if="specList.length">
          <label class="filter-label">Spec</label>
          <select v-model="selectedSpec" class="filter-select">
            <option value="All">All specs</option>
            <option v-for="sp in specList" :key="sp" :value="sp">{{ sp }}</option>
          </select>
        </div>

        <div class="filter-row filter-toggles">
          <label class="toggle-label">
            <input type="checkbox" v-model="bestOnly" />
            Best only
          </label>
          <label class="toggle-label">
            <input type="checkbox" v-model="showTotal" />
            Total damage
          </label>
        </div>

        <button class="fetch-btn" @click="fetchRankings" :disabled="loading">
          {{ loading ? 'Loading…' : 'Search' }}
        </button>
      </div>

      <!-- Results -->
      <div v-if="servers.length && loading" class="loading-rows">
        <div v-for="i in 10" :key="i" class="skeleton-row" />
      </div>

      <p v-else-if="servers.length && error" class="err-msg">{{ error }}</p>

      <p v-else-if="servers.length && !rows.length && !loading" class="empty-msg">No data found.</p>

      <table v-else-if="servers.length" class="top-table">
        <thead>
          <tr>
            <th class="th-rank">#</th>
            <th>Name</th>
            <th class="th-num">{{ showTotal ? 'Total DPS' : 'Useful DPS' }}</th>
            <th class="th-num">{{ showTotal ? 'Total DMG' : 'Useful DMG' }}</th>
            <th class="th-num">Duration</th>
            <th class="th-date">Date</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in rows"
            :key="i"
            class="top-row"
          >
            <!-- row: [report_ID, duration, guid, name, uAmount, tAmount, spec, auras] -->
            <td class="td-rank">{{ i + 1 }}</td>
            <td class="td-name">
              <img
                class="spec-icon"
                :src="specIconSrc(row[6])"
                :alt="specLabel(row[6])"
                :title="specLabel(row[6])"
                width="16"
                height="16"
              />
              <a
                :href="`/character?name=${row[3]}&server=${selectedServer}&spec=${row[6] % 4}`"
                :class="`cls-${specClassSlug(row[6])}`"
                target="_blank"
              >{{ row[3] }}</a>
              <span class="spec-label">{{ specLabel(row[6]) }}</span>
            </td>
            <td class="td-num">{{ fmtDps(showTotal ? row[5] : row[4], row[1]) }}</td>
            <td class="td-num">{{ fmtNum(showTotal ? row[5] : row[4]) }}</td>
            <td class="td-num">{{ fmtDuration(row[1]) }}</td>
            <td class="td-date">{{ fmtDate(row[0]) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
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
  max-width: 960px;
}

.page-title {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  margin: 0 0 1.5rem;
}

/* ── Filters ─────────────────────────────────────────────── */
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid hsl(271, 20%, 14%);
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-label {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.filter-select {
  background: var(--bg);
  border: 1px solid hsl(271, 20%, 20%);
  color: var(--text);
  font-size: 0.8125rem;
  padding: 4px 8px;
  height: 30px;
  min-width: 140px;
}

.filter-toggles {
  flex-direction: row;
  align-items: center;
  gap: 1rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
}

.toggle-label input[type="checkbox"] {
  accent-color: var(--primary);
}

.fetch-btn {
  height: 30px;
  padding: 0 1.25rem;
  background: var(--primary);
  color: #fff;
  border: none;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.8125rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  align-self: flex-end;
}

.fetch-btn:hover:not(:disabled) {
  background: var(--primary-bright);
}

.fetch-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* ── No-data / rebuild ───────────────────────────────────── */
.no-data-panel {
  padding: 2rem;
  background: var(--surface);
  border: 1px solid hsl(271, 20%, 14%);
  text-align: center;
  margin-bottom: 1.5rem;
}

.no-data-msg {
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
  margin: 0 0 0.5rem;
}

.no-data-sub {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin: 0 0 1rem;
}

.rebuild-btn {
  height: 32px;
  padding: 0 1.5rem;
  background: var(--primary);
  color: #fff;
  border: none;
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 600;
  font-size: 0.8125rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.rebuild-btn:hover {
  background: var(--primary-bright);
}

.rebuild-progress {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid hsl(271, 20%, 14%);
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.rebuild-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid hsl(271, 20%, 30%);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Loading / states ────────────────────────────────────── */
.loading-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.skeleton-row {
  height: 34px;
  background: var(--surface);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.8; }
}

.err-msg, .empty-msg {
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* ── Table ───────────────────────────────────────────────── */
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
  padding: 0 8px 6px;
  border-bottom: 1px solid var(--table-border);
}

.th-num, .td-num {
  text-align: right;
}

.th-rank, .td-rank {
  text-align: right;
  width: 40px;
  color: var(--text-muted);
}

.th-date, .td-date {
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

.top-row {
  height: 34px;
  border-bottom: 1px solid var(--table-border);
}

.top-row:hover {
  background: var(--hover-row);
}

.top-row td {
  padding: 0 8px;
}

.td-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spec-icon {
  flex-shrink: 0;
  border-radius: 2px;
  image-rendering: auto;
}

.td-name a {
  text-decoration: none;
  color: var(--text);
  white-space: nowrap;
}

.td-name a:hover {
  color: var(--primary-bright);
}

.spec-label {
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}

/* Class colours (approximate WoW palette) */
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
</style>
