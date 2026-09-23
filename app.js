'use strict';

/* ---------- Constants ---------- */
const STORE_KEY = 'questPlanner.v1';
const APP_VERSION = '1.3.0';
const CODE_HASHES = ['fd1d540d'];
const XP = { main: 30, daily: 10, side: 5, habit: 5, clean: 10 };
const FOCUS_XP = { 10: 8, 25: 15, 45: 25 };
const TITLES = RANKS.map(r => r.name);
const SHIELD_COLORS = ['#2F6BFF', '#1FA855', '#F5A623', '#9B30D9', '#FF2D78', '#00AEEF', '#1E2433', '#FF7A00'];
const HABIT_COLORS = ['#2F6BFF', '#1FA855', '#F5A623', '#9B30D9', '#FF2D78', '#00AEEF'];
const REWARD_ICONS = ['device-gamepad-2', 'cup', 'coffee', 'pizza', 'ice-cream', 'device-tv', 'book', 'shopping-bag',
  'shoe', 'plane', 'car', 'moon', 'gift', 'star'];
const ZONE_ICONS = ['tools-kitchen-2', 'bed', 'bath', 'sofa', 'desk', 'wash-machine', 'car', 'books', 'shirt', 'plant-2', 'home'];
const THEMES = [
  { id: 'day', name: 'Day', dots: ['#F7F7F4', '#2F6BFF', '#F5A623'] },
  { id: 'night', name: 'Night', dots: ['#12161F', '#3DD6F5', '#F5B841'] },
  { id: 'ocean', name: 'Ocean calm', dots: ['#EEF4FA', '#1F6FB2', '#16977A'] },
  { id: 'arcade', name: 'Arcade', dots: ['#1A1433', '#C6F432', '#FF8A3D'] },
  { id: 'berry', name: 'Berry', dots: ['#FFFBF3', '#9B30D9', '#FF2D78'] },
  { id: 'lowstim', name: 'Low stim', dots: ['#F2F2F2', '#222222', '#3B6FD8'] },
];
const BADGES = [
  { id: 'first', name: 'First quest', icon: 'flag', color: '#2F6BFF', test: s => s.stats.quests >= 1 },
  { id: 'q25', name: '25 quests', icon: 'target', color: '#1FA855', test: s => s.stats.quests >= 25 },
  { id: 'q100', name: '100 quests', icon: 'trophy', color: '#F5A623', test: s => s.stats.quests >= 100 },
  { id: 'streak7', name: '7-day streak', icon: 'flame', color: '#F07A12', test: s => bestActivityStreak(s) >= 7 },
  { id: 'focus10', name: '10 focus sessions', icon: 'hourglass', color: '#9B30D9', test: s => s.stats.focus >= 10 },
  { id: 'clean25', name: '25 clean-ups', icon: 'sparkles', color: '#00AEEF', test: s => s.stats.clean >= 25 },
  { id: 'habit50', name: '50 habit checks', icon: 'repeat', color: '#FF2D78', test: s => s.stats.habits >= 50 },
  { id: 'lvl5', name: 'Level 5', icon: 'medal', color: '#1FA855', test: s => levelInfo(s.xpTotal).level >= 5 },
  { id: 'lvl10', name: 'Level 10', icon: 'crown', color: '#F5A623', test: s => levelInfo(s.xpTotal).level >= 10 },
  { id: 'reward1', name: 'First reward', icon: 'gift', color: '#9B30D9', test: s => s.stats.rewards >= 1 },
];

/* ---------- Helpers ---------- */
const $ = sel => document.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hashCode(input) {
  const s = 'aq-salt:' + input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let x = 0x811c9dc5;
  for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 0x01000193) >>> 0; }
  return x.toString(16);
}

function levelInfo(total) {
  let level = 1, need = 100, left = total;
  while (left >= need) { left -= need; level++; need = 100 + (level - 1) * 50; }
  return { level, into: left, need, title: TITLES[Math.min(level - 1, TITLES.length - 1)] };
}

// Streak with one free skip: a single missed day never breaks it, two in a row do.
function streakOf(isOn) {
  let d = dayKey(), count = 0, miss = 0;
  if (!isOn(d)) d = addDays(d, -1);
  for (let i = 0; i < 800; i++) {
    if (isOn(d)) { count++; miss = 0; } else if (++miss >= 2) break;
    d = addDays(d, -1);
  }
  return count;
}
const activityStreak = s => streakOf(d => (s.xpLog[d] || 0) > 0);
function bestActivityStreak(s) {
  s.bestStreak = Math.max(s.bestStreak || 0, activityStreak(s));
  return s.bestStreak;
}

/* ---------- State ---------- */
function defaultState() {
  const t = dayKey();
  const task = title => ({ id: uid(), title, last: null, prev: null });
  return {
    v: 1, unlocked: false, onboarded: false, route: 'today', day: t,
    profile: { name: '', color: '#2F6BFF' },
    settings: { theme: 'day', autoNight: false, reduceMotion: false, vibrate: true },
    xpTotal: 0, coins: 0, xpLog: {}, bestStreak: 0,
    stats: { quests: 0, habits: 0, focus: 0, focusMin: 0, clean: 0, rewards: 0 },
    quests: [
      { id: uid(), title: 'Plan tomorrow (2 minutes)', type: 'daily', done: false },
      { id: uid(), title: 'Check my calendar', type: 'daily', done: false },
    ],
    habits: [
      { id: uid(), title: 'Drink water', color: '#00AEEF', log: {} },
      { id: uid(), title: 'Move for 10 minutes', color: '#1FA855', log: {} },
      { id: uid(), title: 'Bed on time', color: '#9B30D9', log: {} },
    ],
    zones: [
      { id: uid(), name: 'Kitchen', icon: 'tools-kitchen-2', open: true, tasks: [task('Wash the dishes'), task('Wipe the counters'), task('Take out the trash')] },
      { id: uid(), name: 'Bedroom', icon: 'bed', open: false, tasks: [task('Make the bed'), task('Clothes into the hamper'), task('Clear the nightstand')] },
      { id: uid(), name: 'Bathroom', icon: 'bath', open: false, tasks: [task('Wipe the sink'), task('Swap the towels'), task('Quick toilet clean')] },
      { id: uid(), name: 'Living room', icon: 'sofa', open: false, tasks: [task('Collect cups and plates'), task('Clear the table'), task('Vacuum the floor')] },
      { id: uid(), name: 'Desk', icon: 'desk', open: false, tasks: [task('Clear the desk surface'), task('Sort loose papers')] },
    ],
    rewards: [
      { id: uid(), title: 'Favorite drink', icon: 'cup', cost: 80 },
      { id: uid(), title: '1 hour of gaming', icon: 'device-gamepad-2', cost: 150 },
      { id: uid(), title: 'Movie night', icon: 'device-tv', cost: 300 },
      { id: uid(), title: 'Buy something small', icon: 'shopping-bag', cost: 400 },
    ],
    focus: { mins: 25, questId: '', run: null },
    dump: [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* fall through to a fresh state */ }
  return defaultState();
}
let S = load();
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { toast('Storage is full or blocked'); }
}

// New day: reset daily quests, clear finished one-off quests.
function rollover() {
  const t = dayKey();
  if (S.day === t) return false;
  S.quests = S.quests.filter(q => q.type === 'daily' || !q.done);
  S.quests.forEach(q => { if (q.type === 'daily') q.done = false; });
  S.day = t;
  save();
  return true;
}

/* ---------- Rewards engine ---------- */
let shownPct = null;
function award(amount, el) {
  const before = levelInfo(S.xpTotal).level;
  S.xpTotal += amount;
  S.coins += amount;
  const t = dayKey();
  S.xpLog[t] = (S.xpLog[t] || 0) + amount;
  bestActivityStreak(S);
  save();
  buzz(25);
  if (el) floatXP(el, '+' + amount + ' XP');
  const after = levelInfo(S.xpTotal);
  if (after.level > before) setTimeout(() => levelUp(after), 450);
}
function revoke(amount) {
  S.xpTotal = Math.max(0, S.xpTotal - amount);
  S.coins = Math.max(0, S.coins - amount);
  const t = dayKey();
  S.xpLog[t] = Math.max(0, (S.xpLog[t] || 0) - amount);
  save();
}

function buzz(pattern) {
  const tapped = !navigator.userActivation || navigator.userActivation.hasBeenActive;
  if (S.settings.vibrate && navigator.vibrate && tapped) { try { navigator.vibrate(pattern); } catch (e) { } }
}
function motionOff() {
  return S.settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function floatXP(el, text) {
  if (motionOff()) return;
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'xp-float';
  f.textContent = text;
  f.style.left = (r.left + r.width / 2 - 30) + 'px';
  f.style.top = (r.top - 6) + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 950);
}
function confetti(n = 70) {
  if (motionOff()) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#FF2D78', '#FF7A00', '#FFC700', '#1FB854', '#00AEEF', '#9B30D9'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    const size = 6 + Math.random() * 8;
    p.style.left = Math.random() * 100 + 'vw';
    p.style.width = size + 'px';
    p.style.height = (Math.random() > .5 ? size : size * .45) + 'px';
    p.style.background = colors[i % colors.length];
    p.style.borderRadius = Math.random() > .6 ? '50%' : '2px';
    p.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
    p.style.animationDelay = (Math.random() * .4) + 's';
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3800);
}
let toastTimer;
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}
function levelUp(info) {
  confetti(110);
  buzz([40, 60, 40]);
  sheet(`<div class="levelup">
    <div class="emblem-pop">${rankEmblem(info.level, 150)}</div>
    <p class="sub" style="margin:6px 0 0">Level ${info.level} · New rank unlocked</p>
    <h3 class="rank-title">${esc(info.title)}</h3>
    <p class="sub">${tierName(info.level)} rank. ${info.level < RANKS.length ? 'Next: ' + esc(rankFor(info.level + 1).name) + '.' : 'You reached the top.'}</p>
    <button class="btn ghost" data-act="ranks" style="margin-bottom:8px">See all ranks</button>
    <button class="btn" data-act="close">Nice</button></div>`);
  checkBadges();
}
function checkBadges() {
  S.badges = S.badges || [];
  const fresh = BADGES.filter(b => !S.badges.includes(b.id) && b.test(S));
  if (!fresh.length) return;
  fresh.forEach(b => S.badges.push(b.id));
  save();
  setTimeout(() => toast('Badge unlocked: ' + fresh.map(b => b.name).join(', ')), 600);
}

/* ---------- Theme ---------- */
function applyTheme() {
  const dark = S.settings.autoNight && matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'night' : S.settings.theme;
  document.body.classList.toggle('reduce-motion', !!S.settings.reduceMotion);
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute('content', bg);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ---------- Sheet ---------- */
function sheet(html, onMount) {
  closeSheet();
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  o.addEventListener('click', e => { if (e.target === o) closeSheet(); });
  document.body.appendChild(o);
  if (onMount) onMount(o.querySelector('.sheet'));
  const first = o.querySelector('input.field');
  if (first) setTimeout(() => first.focus(), 60);
}
function closeSheet() { document.querySelectorAll('.overlay').forEach(o => o.remove()); }

/* ---------- Screens ---------- */
function heroHTML() {
  const L = levelInfo(S.xpTotal);
  const pct = Math.round(L.into / L.need * 100);
  const start = shownPct === null ? pct : shownPct;
  shownPct = pct;
  return `<div class="hero">
    <button class="hero-emblem" data-act="ranks" aria-label="See all ranks">${rankEmblem(L.level, 58)}</button>
    <div class="hero-mid">
      <div class="hero-name">${esc(L.title)}</div>
      <div class="bar"><i data-pct="${pct}" style="width:${start}%"></i></div>
      <div class="hero-xp"><span>Level ${L.level} · ${L.into} / ${L.need} XP</span><span>${esc(S.profile.name || 'Player')}</span></div>
    </div>
    <div class="streak" title="Days in a row">${icon('flame')}${activityStreak(S)}d</div>
    <button class="gear" data-act="go" data-to="settings" aria-label="Settings">${icon('settings')}</button>
  </div>`;
}

function questRow(q) {
  return `<div class="row ${q.type === 'main' ? 'main' : ''} ${q.done ? 'done' : ''}">
    <button class="check" data-act="toggleQuest" data-id="${q.id}" aria-label="${q.done ? 'Mark not done' : 'Complete'}: ${esc(q.title)}">${icon('check')}</button>
    <div class="row-title">${esc(q.title)}</div>
    <span class="chip ${q.type}">+${XP[q.type]}</span>
    <button class="icon-btn" data-act="editQuest" data-id="${q.id}" aria-label="Edit">${icon('pencil')}</button>
  </div>`;
}

function screenToday() {
  const by = t => S.quests.filter(q => q.type === t);
  const main = by('main'), daily = by('daily'), side = by('side');
  const doneToday = S.quests.filter(q => q.done).length;
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${heroHTML()}${installBanner()}
    <p class="sub" style="margin:14px 2px 0">${hello}${S.profile.name ? ', ' + esc(S.profile.name) : ''}. ${doneToday ? doneToday + ' done today.' : 'Pick one small thing to start.'}</p>
    <div class="dump">
      <span class="dump-ic">${icon('brain')}</span>
      <input class="dump-in" id="dumpInput" maxlength="140" placeholder="Brain dump: get a thought out of your head" autocomplete="off" aria-label="Brain dump">
      <button class="dump-add" data-act="dumpAdd" aria-label="Save thought">${icon('plus')}</button>
    </div>
    ${S.dump.length ? `<button class="inbox-link" data-act="dumpOpen">${icon('list-check')} ${S.dump.length} thought${S.dump.length > 1 ? 's' : ''} in your inbox <span>Sort ${icon('chevron-right')}</span></button>` : ''}
    <div class="sec">${icon('target')} Main quest</div>
    ${main.length ? main.map(questRow).join('') : `<button class="empty" style="width:100%" data-act="addQuest" data-type="main">Choose the one thing that matters most today</button>`}
    <div class="sec">${icon('repeat')} Daily quests <span class="count">${daily.filter(q => q.done).length}/${daily.length}</span></div>
    ${daily.length ? daily.map(questRow).join('') : `<div class="empty">Daily quests come back every morning</div>`}
    <div class="sec">${icon('flag')} Side quests</div>
    ${side.length ? side.map(questRow).join('') : `<div class="empty">Small extras go here</div>`}
    <div class="fab-row"><button class="btn" data-act="addQuest">${icon('plus')} Add quest</button></div>`;
}

function screenHabits() {
  const t = dayKey();
  const days = [...Array(7)].map((_, i) => addDays(t, i - 6));
  const cards = S.habits.map(h => {
    const st = streakOf(d => !!h.log[d]);
    return `<div class="habit" style="--hc:${h.color}">
      <div class="habit-top">
        <div class="habit-name">${esc(h.title)}</div>
        <span class="habit-streak">${icon('flame')}${st}</span>
        <button class="icon-btn" data-act="editHabit" data-id="${h.id}" aria-label="Edit habit">${icon('pencil')}</button>
      </div>
      <div class="days">${days.map(d => `<div class="day"><span>${d === t ? 'Today' : WEEKDAY[parseDay(d).getDay()]}</span>
        <button class="${h.log[d] ? 'on' : ''} ${d === t ? 'today' : ''}" data-act="toggleHabit" data-id="${h.id}" data-day="${d}" aria-label="${esc(h.title)} ${d}">${h.log[d] ? icon('check') : ''}</button></div>`).join('')}</div>
    </div>`;
  }).join('');
  return `<h1 class="title">Habits</h1><p class="sub">Small wins, every day. +${XP.habit} XP per check.</p>
    ${cards ? `<div class="habit-grid">${cards}</div>` : `<div class="empty">Add your first habit below</div>`}
    <p class="note">Missed a day? One skip won't break your streak.</p>
    <button class="btn" data-act="addHabit">${icon('plus')} Add habit</button>`;
}

function focusLeft() {
  const r = S.focus.run;
  if (!r) return S.focus.mins * 60;
  if (r.pausedLeft != null) return r.pausedLeft;
  return Math.max(0, Math.round((r.endAt - Date.now()) / 1000));
}
function screenFocus() {
  const r = S.focus.run;
  const total = r ? r.total : S.focus.mins * 60;
  const left = focusLeft();
  const C = 2 * Math.PI * 106;
  const off = C * (1 - (total - left) / total);
  const open = S.quests.filter(q => !q.done);
  const q = S.quests.find(x => x.id === (r ? r.questId : S.focus.questId));
  const mins = r ? r.mins : S.focus.mins;
  return `<h1 class="title">Focus mode</h1><p class="sub">A quiet timer. No sound, just progress.</p>
    <div class="ring-wrap"><div class="ring">
      <svg viewBox="0 0 240 240"><circle class="track" cx="120" cy="120" r="106"/><circle class="prog" id="ringProg" cx="120" cy="120" r="106" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg>
      <div class="ring-center"><div class="ring-time" id="ringTime">${pad(Math.floor(left / 60))}:${pad(left % 60)}</div>
      <div class="ring-sub">${r ? (r.pausedLeft != null ? 'Paused' : 'Stay with it') : mins + ' min session'}</div></div>
    </div></div>
    ${r ? `<div class="row" style="justify-content:center;text-align:center"><div><div class="row-meta">Working on</div><b>${q ? esc(q.title) : 'Free focus'}</b></div></div>
      <div class="btn-row">
        <button class="btn ghost" data-act="focusStop">${icon('player-stop')} Stop</button>
        <button class="btn" data-act="focusPause">${r.pausedLeft != null ? icon('player-play') + ' Resume' : icon('player-pause') + ' Pause'}</button>
      </div>`
    : `<div class="pills">${[10, 25, 45].map(m => `<button class="pill ${S.focus.mins === m ? 'on' : ''}" data-act="focusMins" data-m="${m}">${m} min</button>`).join('')}</div>
      <label class="lbl" for="focusQuest">Working on</label>
      <select class="field" id="focusQuest" data-change="focusQuest">
        <option value="">Free focus</option>
        ${open.map(o => `<option value="${o.id}" ${o.id === S.focus.questId ? 'selected' : ''}>${esc(o.title)}</option>`).join('')}
      </select>
      <div style="margin-top:14px"><button class="btn" data-act="focusStart">${icon('player-play')} Start focus</button></div>`}
    <p class="note">+${FOCUS_XP[mins]} XP when the timer ends</p>`;
}

function lastLabel(last) {
  if (!last) return 'Never done';
  const n = daysBetween(last, dayKey());
  return n === 0 ? 'Done today' : n === 1 ? 'Yesterday' : n + ' days ago';
}
function screenClean() {
  const t = dayKey();
  const zones = S.zones.map(z => {
    const done = z.tasks.filter(k => k.last === t).length;
    return `<div class="zone ${z.open ? 'open' : ''}">
      <button class="zone-head" data-act="toggleZone" data-id="${z.id}" aria-expanded="${z.open}">
        <span class="zone-ic">${icon(z.icon)}</span><span class="zone-name">${esc(z.name)}</span>
        <span class="zone-prog">${done}/${z.tasks.length}</span>${icon('chevron-right', 'chev')}
      </button>
      ${z.open ? `<div class="zone-body">
        ${z.tasks.map(k => `<div class="row ${k.last === t ? 'done' : ''}">
          <button class="check" data-act="toggleClean" data-z="${z.id}" data-id="${k.id}" aria-label="Clean: ${esc(k.title)}">${icon('check')}</button>
          <div class="row-title">${esc(k.title)}<div class="row-meta">${lastLabel(k.last)}</div></div>
          <button class="icon-btn" data-act="editClean" data-z="${z.id}" data-id="${k.id}" aria-label="Edit">${icon('pencil')}</button>
        </div>`).join('')}
        <div class="btn-row" style="margin-top:6px">
          <button class="btn ghost" data-act="addClean" data-z="${z.id}">${icon('plus')} Task</button>
          <button class="btn ghost" data-act="editZone" data-z="${z.id}">${icon('pencil')} Zone</button>
        </div></div>` : ''}
    </div>`;
  }).join('');
  return `<h1 class="title">Cleaning quests</h1><p class="sub">Tiny tasks, no marathon cleaning. +${XP.clean} XP each.</p>
    <button class="btn" data-act="quickClean">${icon('dice-5')} Give me a 5-minute mission</button>
    <div class="sec">${icon('home')} Zones</div>
    ${zones ? `<div class="zones-grid">${zones}</div>` : `<div class="empty">Add a zone like Kitchen or Desk</div>`}
    <div style="margin-top:10px"><button class="btn ghost" data-act="addZone">${icon('plus')} Add zone</button></div>`;
}

function screenRewards() {
  S.badges = S.badges || [];
  const rewards = S.rewards.map(r => `<div class="row">
    <span class="reward-ic">${icon(r.icon)}</span>
    <div class="row-title">${esc(r.title)}</div>
    <button class="cost ${S.coins < r.cost ? 'locked' : ''}" data-act="redeem" data-id="${r.id}" aria-label="Redeem for ${r.cost} coins">${icon('coin')}${r.cost}</button>
    <button class="icon-btn" data-act="editReward" data-id="${r.id}" aria-label="Edit">${icon('pencil')}</button>
  </div>`).join('');
  const badges = BADGES.map(b => {
    const got = S.badges.includes(b.id);
    return `<div class="badge ${got ? '' : 'locked'}"><div class="badge-ic" style="background:${b.color}">${icon(got ? b.icon : 'lock')}</div>${esc(b.name)}</div>`;
  }).join('');
  return `<div style="display:flex;justify-content:space-between;align-items:center">
      <h1 class="title">Reward shop</h1><span class="wallet">${icon('coin')}${S.coins}</span></div>
    <p class="sub">You earn a coin for every XP. Spend them on real-life rewards you choose.</p>
    ${rewards || `<div class="empty">Add a reward that feels worth working for</div>`}
    <button class="btn ghost" style="margin-top:4px" data-act="addReward">${icon('plus')} Add reward</button>
    <div class="sec">${icon('medal')} Badges <span class="count">${S.badges.length}/${BADGES.length}</span></div>
    <div class="badges">${badges}</div>`;
}

function toggleRow(act, on, title, sub) {
  return `<button class="set-row" data-act="${act}" role="switch" aria-checked="${on}">
    <span class="grow">${title}<small>${sub}</small></span><span class="toggle ${on ? 'on' : ''}"></span></button>`;
}
function screenSettings() {
  const t = dayKey();
  const week = [...Array(7)].map((_, i) => addDays(t, i - 6));
  const max = Math.max(10, ...week.map(d => S.xpLog[d] || 0));
  const L = levelInfo(S.xpTotal);
  return `<div style="display:flex;align-items:center;gap:8px">
      <button class="icon-btn" data-act="go" data-to="today" aria-label="Back">${icon('arrow-left')}</button>
      <h1 class="title" style="margin:0">Settings</h1></div>
    <div class="sec">${icon('shield')} Profile</div>
    <button class="set-row" data-act="ranks">${icon('trophy')}<span class="grow">Ranks<small>${RANKS.length} ranks from Rookie to Legend</small></span>${icon('chevron-right')}</button>
    <button class="set-row" data-act="editProfile">
      ${rankEmblem(L.level, 48)}
      <span class="grow"><b>${esc(S.profile.name || 'Player')}</b><small>Level ${L.level} · ${esc(L.title)} · ${S.xpTotal} XP total</small></span>${icon('chevron-right')}</button>
    <div class="sec">${icon('palette')} Theme</div>
    <div class="themes">${THEMES.map(th => `<button class="theme-card ${S.settings.theme === th.id ? 'on' : ''}" style="background:${th.dots[0]};color:${['night', 'arcade'].includes(th.id) ? '#F1ECFF' : '#1E2433'}" data-act="setTheme" data-id="${th.id}">
      <span class="theme-dots">${th.dots.map(c => `<i style="background:${c};border:1px solid #8884"></i>`).join('')}</span>${th.name}</button>`).join('')}</div>
    <div style="margin-top:8px">
    ${toggleRow('toggleAutoNight', S.settings.autoNight, 'Night theme follows my device', 'Switches to Night when your phone is in dark mode')}
    ${toggleRow('toggleMotion', S.settings.reduceMotion, 'Reduce motion', 'Turns off confetti and animations')}
    ${toggleRow('toggleVibrate', S.settings.vibrate, 'Vibration', 'A light tap when you finish something')}
    </div>
    <div class="sec">${icon('chart-bar')} This week</div>
    <div class="week">${week.map(d => `<div><i style="height:${Math.round((S.xpLog[d] || 0) / max * 70)}px"></i>${d === t ? 'Today' : WEEKDAY[parseDay(d).getDay()][0]}</div>`).join('')}</div>
    <div class="stats" style="margin-top:8px">
      <div class="stat"><b>${S.stats.quests}</b><span>Quests done</span></div>
      <div class="stat"><b>${S.stats.focusMin}</b><span>Focus minutes</span></div>
      <div class="stat"><b>${S.stats.habits}</b><span>Habit checks</span></div>
      <div class="stat"><b>${bestActivityStreak(S)}</b><span>Best streak (days)</span></div>
    </div>
    <div class="sec">${icon('download')} Backup</div>
    <p class="sub" style="margin-bottom:8px">Your data lives only on this device. Save a backup file now and then, or to move to a new phone.</p>
    <button class="btn ghost" data-act="exportData">${icon('download')} Save backup file</button>
    <button class="btn ghost" data-act="importData">${icon('upload')} Restore from backup</button>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <div class="sec">${icon('info-circle')} Help</div>
    <button class="set-row" data-act="install">${icon('device-mobile')}<span class="grow">${isStandalone() ? 'Installed' : 'Install the app'}<small>${isStandalone() ? 'Quest Planner is on your home screen' : 'Add it to your home screen. Works offline.'}</small></span>${icon('chevron-right')}</button>
    <div class="sec">${icon('trash')} Danger zone</div>
    <button class="btn danger" data-act="resetAll">Erase all my data</button>
    <p class="note">Quest Planner v${APP_VERSION} · No account, no tracking, works offline</p>`;
}

/* ---------- Lock and onboarding ---------- */
function screenLock() {
  return `<div class="center">
    <div class="logo">${icon('shield')}</div>
    <h1>Quest Planner</h1>
    <p class="lead">Enter the access code from your purchase PDF to start.</p>
    <input class="field" id="codeInput" placeholder="XXXXXXX-0000" autocomplete="off" autocapitalize="characters" spellcheck="false" style="text-align:center;font-weight:800;letter-spacing:.08em">
    <div class="err" id="codeErr"></div>
    <button class="btn" data-act="unlock">${icon('key')} Unlock</button>
  </div>`;
}
let obStep = 1;
function screenOnboard() {
  const steps = `<div class="steps">${[1, 2, 3].map(i => `<i class="${i <= obStep ? 'on' : ''}"></i>`).join('')}</div>`;
  if (obStep === 1) return `<div class="center">${steps}
    <div class="logo">${icon('rocket')}</div>
    <h1>Your day, as a game</h1>
    <p class="lead">Finish quests, earn XP, level up, and trade coins for rewards you pick.</p>
    <label class="lbl" for="obName">What should we call you?</label>
    <input class="field" id="obName" maxlength="24" placeholder="Alex" value="${esc(S.profile.name)}">
    <div style="margin-top:16px"><button class="btn" data-act="obNext">Next</button></div></div>`;
  if (obStep === 2) return `<div class="center">${steps}
    <div class="rank-preview">${[1, 4, 7, 10, 12].map(l => rankEmblem(l, 62)).join('')}</div>
    <h1>Climb 12 ranks</h1>
    <p class="lead">From Rookie to Legend. Every quest moves you up. Now pick a theme you can change any time.</p>
    <label class="lbl">Theme</label>
    <div class="themes">${THEMES.map(th => `<button class="theme-card ${S.settings.theme === th.id ? 'on' : ''}" style="background:${th.dots[0]};color:${['night', 'arcade'].includes(th.id) ? '#F1ECFF' : '#1E2433'}" data-act="setTheme" data-id="${th.id}">
      <span class="theme-dots">${th.dots.map(c => `<i style="background:${c};border:1px solid #8884"></i>`).join('')}</span>${th.name}</button>`).join('')}</div>
    <div class="btn-row"><button class="btn ghost" data-act="obBack">Back</button><button class="btn" data-act="obNext">Next</button></div></div>`;
  return `<div class="center">${steps}
    <div class="logo">${icon('device-mobile')}</div>
    <h1>Keep it one tap away</h1>
    <p class="lead">Add Quest Planner to your home screen. It then opens like a normal app and works without internet.</p>
    ${isStandalone() ? `<div class="howto ok">${icon('check')} Installed. You're all set.</div>`
      : installEvt ? `<button class="btn" data-act="install" style="margin-bottom:10px">${icon('download')} Install app</button>`
      : installGuide()}
    <div class="btn-row"><button class="btn ghost" data-act="obBack">Back</button><button class="btn${installEvt && !isStandalone() ? ' ghost' : ''}" data-act="obDone">${installEvt && !isStandalone() ? 'Later' : 'Start playing'}</button></div></div>`;
}

/* ---------- Install (Add to Home Screen) ---------- */
let installEvt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /android/i.test(navigator.userAgent);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (S.unlocked) render(); });
window.addEventListener('appinstalled', () => {
  installEvt = null; S.installed = true; save(); render();
  toast('Installed. Open Quest Planner from your home screen.');
});

const step = (n, ic, html) => `<div class="istep"><span class="istep-n">${n}</span><div class="grow">${html}</div>${ic ? `<span class="istep-ic">${icon(ic)}</span>` : ''}</div>`;
function guideFor(p) {
  if (p === 'ios') return step(1, 'square-arrow-up', 'Tap the <b>Share</b> button in Safari. It is at the bottom of the screen on iPhone, top right on iPad.')
    + step(2, 'square-plus', 'Scroll down and tap <b>Add to Home Screen</b>.')
    + step(3, null, 'Tap <b>Add</b> in the top right corner. Done.')
    + `<p class="row-meta" style="margin:6px 2px 0">Using Chrome on iPhone? Tap the share icon in the address bar, then Add to Home Screen.</p>`;
  if (p === 'android') return step(1, 'dots-vertical', 'Tap the <b>menu</b> (three dots) at the top right of Chrome.')
    + step(2, 'download', 'Tap <b>Install app</b> or <b>Add to Home screen</b>.')
    + step(3, null, 'Tap <b>Install</b>. The app appears with your other apps.');
  return step(1, 'download', 'In Chrome or Edge, click the <b>install icon</b> at the right end of the address bar.')
    + step(2, null, 'Click <b>Install</b>. Quest Planner opens in its own window.');
}
function installGuide() {
  const p = isIOS() ? 'ios' : isAndroid() ? 'android' : 'desktop';
  const names = { ios: 'iPhone and iPad', android: 'Android', desktop: 'Computer' };
  const others = ['ios', 'android', 'desktop'].filter(x => x !== p);
  return `<div class="guide">${guideFor(p)}</div>
    ${others.map(o => `<details class="guide-other"><summary>${names[o]}</summary><div class="guide">${guideFor(o)}</div></details>`).join('')}`;
}
function installBanner() {
  if (isStandalone() || S.installed) return '';
  if (S.installSnooze && daysBetween(S.installSnooze, dayKey()) < 3) return '';
  return `<div class="install-card">
    <span class="install-ic">${icon('device-mobile')}</span>
    <div class="grow"><b>Install the app</b><small>One tap from your home screen. Works offline.</small></div>
    <button class="install-btn" data-act="install">${installEvt ? 'Install' : 'Show me'}</button>
    <button class="icon-btn" data-act="installLater" aria-label="Not now">${icon('x')}</button>
  </div>`;
}

/* ---------- Render ---------- */
const TABS = [
  { id: 'today', label: 'Today', icon: 'sword' },
  { id: 'habits', label: 'Habits', icon: 'repeat' },
  { id: 'focus', label: 'Focus', icon: 'hourglass' },
  { id: 'clean', label: 'Clean', icon: 'sparkles' },
  { id: 'rewards', label: 'Rewards', icon: 'gift' },
];
const SCREENS = { today: screenToday, habits: screenHabits, focus: screenFocus, clean: screenClean, rewards: screenRewards, settings: screenSettings };

function render() {
  applyTheme();
  const app = $('#app');
  if (!S.unlocked) { app.innerHTML = screenLock(); return; }
  if (!S.onboarded) { app.innerHTML = screenOnboard(); return; }
  const route = SCREENS[S.route] ? S.route : 'today';
  app.innerHTML = `<main class="screen">${SCREENS[route]()}</main>
    <nav class="nav" aria-label="Main"><div class="nav-in">${TABS.map(t => `<button class="${route === t.id ? 'on' : ''}" data-act="go" data-to="${t.id}" aria-current="${route === t.id ? 'page' : 'false'}">${icon(t.icon)}${t.label}</button>`).join('')}</div></nav>`;
  const bar = app.querySelector('.bar > i');
  if (bar) requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = bar.dataset.pct + '%'; }));
}

/* ---------- Sheets for editing ---------- */
function questSheet(q, presetType) {
  const type = q ? q.type : (presetType || 'side');
  sheet(`<h3>${q ? 'Edit quest' : 'New quest'}</h3>
    <p class="sub">Keep it small and clear, like "Email the teacher".</p>
    <input class="field" id="qTitle" maxlength="80" placeholder="What needs doing?" value="${q ? esc(q.title) : ''}">
    <label class="lbl">Quest type</label>
    <div class="seg" id="qType">
      ${['main', 'daily', 'side'].map(t => `<button data-t="${t}" class="${t === type ? 'on' : ''}">${t[0].toUpperCase() + t.slice(1)} +${XP[t]}</button>`).join('')}
    </div>
    <p class="row-meta" style="margin-top:8px">Main: your one big thing today. Daily: repeats every day. Side: one-off extras.</p>
    <div class="btn-row">${q ? `<button class="btn danger" data-act="delQuest" data-id="${q.id}">${icon('trash')}</button>` : ''}
      <button class="btn" data-act="saveQuest" data-id="${q ? q.id : ''}">${q ? 'Save' : 'Add quest'}</button></div>`,
    el => {
      el.querySelector('#qType').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        el.querySelectorAll('#qType button').forEach(x => x.classList.toggle('on', x === b));
      });
      el.querySelector('#qTitle').addEventListener('keydown', e => { if (e.key === 'Enter') el.querySelector('[data-act="saveQuest"]').click(); });
    });
}

function simpleSheet({ title, sub, value, placeholder, extra = '', onSave, onDelete, saveLabel = 'Save' }) {
  sheet(`<h3>${title}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}
    <input class="field" id="sTitle" maxlength="60" placeholder="${placeholder}" value="${value ? esc(value) : ''}">
    ${extra}
    <div class="err" id="sErr"></div>
    <div class="btn-row">${onDelete ? `<button class="btn danger" id="sDel" aria-label="Delete">${icon('trash')}</button>` : ''}
      <button class="btn" id="sSave">${saveLabel}</button></div>`,
    el => {
      const go = () => {
        const v = el.querySelector('#sTitle').value.trim();
        if (!v) { el.querySelector('#sErr').textContent = 'Give it a name first'; return; }
        if (onSave(v, el) !== false) { closeSheet(); save(); render(); }
      };
      el.querySelector('#sSave').addEventListener('click', go);
      el.querySelector('#sTitle').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      el.querySelector('#sTitle').addEventListener('input', () => { el.querySelector('#sErr').textContent = ''; });
      if (onDelete) el.querySelector('#sDel').addEventListener('click', () => {
        const b = el.querySelector('#sDel');
        if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Sure?'; return; }
        onDelete(); closeSheet(); save(); render();
      });
      el.querySelectorAll('.pick').forEach(p => p.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        p.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        p.querySelectorAll('.swatch').forEach(x => x.classList.toggle('on', b.contains(x)));
      }));
    });
}
const iconPicker = (list, cur) => `<label class="lbl">Icon</label><div class="pick" id="pickIcon">${list.map(i => `<button data-v="${i}" class="${i === cur ? 'on' : ''}" aria-label="${i}">${icon(i)}</button>`).join('')}</div>`;
const colorPicker = (list, cur) => `<label class="lbl">Color</label><div class="pick" id="pickColor">${list.map(c => `<button data-v="${c}" style="border:none;padding:0" aria-label="Color ${c}"><span class="swatch ${c === cur ? 'on' : ''}" style="background:${c};display:block"></span></button>`).join('')}</div>`;
const picked = (el, id, fallback) => { const b = el.querySelector(`#${id} button.on`) || el.querySelector(`#${id} .swatch.on`)?.closest('button'); return b ? b.dataset.v : fallback; };

/* ---------- Actions ---------- */
const findQ = id => S.quests.find(q => q.id === id);
const ACTIONS = {
  go(b) { S.route = b.dataset.to; save(); render(); window.scrollTo(0, 0); },
  close() { closeSheet(); },

  unlock() {
    const v = $('#codeInput').value;
    if (!v.trim()) { $('#codeErr').textContent = 'Enter your access code'; return; }
    if (!CODE_HASHES.includes(hashCode(v))) { $('#codeErr').textContent = "That code doesn't match. Check the PDF and try again."; buzz([30, 40, 30]); return; }
    S.unlocked = true; save(); confetti(); render();
  },
  obNext() {
    if (obStep === 1) { S.profile.name = ($('#obName').value || '').trim().slice(0, 24); }
    obStep = Math.min(3, obStep + 1); save(); render();
  },
  obBack() { obStep = Math.max(1, obStep - 1); render(); },
  obColor(b) { S.profile.color = b.dataset.c; save(); render(); },
  obDone() { S.onboarded = true; S.route = 'today'; save(); render(); confetti(); },

  addQuest(b) { questSheet(null, b.dataset.type); },
  editQuest(b) { questSheet(findQ(b.dataset.id)); },
  saveQuest(b) {
    const title = $('#qTitle').value.trim();
    if (!title) { $('#qTitle').focus(); toast('Give your quest a name'); return; }
    const type = document.querySelector('#qType button.on').dataset.t;
    let q = findQ(b.dataset.id);
    if (type === 'main') S.quests.filter(x => x.type === 'main' && x !== q && !x.done).forEach(x => { x.type = 'side'; toast('Old main quest moved to side quests'); });
    if (q) {
      if (q.done && q.type !== type) { revoke(XP[q.type]); award(XP[type]); }
      q.title = title; q.type = type;
    } else S.quests.push({ id: uid(), title, type, done: false });
    closeSheet(); save(); render();
  },
  delQuest(b) {
    const q = findQ(b.dataset.id);
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Sure?'; return; }
    S.quests = S.quests.filter(x => x !== q); closeSheet(); save(); render();
  },
  toggleQuest(b) {
    const q = findQ(b.dataset.id); if (!q) return;
    q.done = !q.done;
    if (q.done) { S.stats.quests++; award(XP[q.type], b); if (q.type === 'main') confetti(); }
    else { S.stats.quests = Math.max(0, S.stats.quests - 1); revoke(XP[q.type]); }
    save(); render(); checkBadges();
    const all = S.quests.length && S.quests.every(x => x.done);
    if (q.done && all) { confetti(120); toast('Every quest done today'); }
  },

  dumpAdd() {
    const inp = $('#dumpInput');
    const text = (inp.value || '').trim();
    if (!text) { inp.focus(); return; }
    S.dump.unshift({ id: uid(), text, at: dayKey() });
    save(); render(); buzz(15);
    toast('Saved. Your brain can let it go now.');
    $('#dumpInput').focus();
  },
  dumpOpen() {
    if (!S.dump.length) { closeSheet(); render(); return; }
    sheet(`<h3>Brain dump inbox</h3>
      <p class="sub">Turn a thought into a quest, or let it go.</p>
      ${S.dump.map(d => `<div class="row">
        <div class="row-title">${esc(d.text)}<div class="row-meta">${lastLabel(d.at).replace('Done today', 'Today')}</div></div>
        <button class="chip side" data-act="dumpToQuest" data-id="${d.id}">To quest</button>
        <button class="icon-btn" data-act="dumpDel" data-id="${d.id}" aria-label="Delete thought">${icon('trash')}</button>
      </div>`).join('')}
      <button class="btn ghost" style="margin-top:10px" data-act="close">Done</button>`);
  },
  dumpToQuest(b) {
    const d = S.dump.find(x => x.id === b.dataset.id); if (!d) return;
    S.dump = S.dump.filter(x => x !== d);
    S.quests.push({ id: uid(), title: d.text.slice(0, 80), type: 'side', done: false });
    save(); render(); toast('Added to side quests');
    ACTIONS.dumpOpen();
  },
  dumpDel(b) {
    S.dump = S.dump.filter(x => x.id !== b.dataset.id);
    save(); render(); ACTIONS.dumpOpen();
  },

  toggleHabit(b) {
    const h = S.habits.find(x => x.id === b.dataset.id); if (!h) return;
    const d = b.dataset.day;
    if (h.log[d]) { delete h.log[d]; S.stats.habits = Math.max(0, S.stats.habits - 1); revoke(XP.habit); }
    else { h.log[d] = true; S.stats.habits++; award(XP.habit, b); }
    save(); render(); checkBadges();
  },
  addHabit() {
    simpleSheet({
      title: 'New habit', sub: 'Something small you want to do most days.', placeholder: 'Stretch for 5 minutes',
      extra: colorPicker(HABIT_COLORS, HABIT_COLORS[S.habits.length % HABIT_COLORS.length]), saveLabel: 'Add habit',
      onSave: (v, el) => { S.habits.push({ id: uid(), title: v, color: picked(el, 'pickColor', HABIT_COLORS[0]), log: {} }); },
    });
  },
  editHabit(b) {
    const h = S.habits.find(x => x.id === b.dataset.id);
    simpleSheet({
      title: 'Edit habit', value: h.title, placeholder: 'Habit name', extra: colorPicker(HABIT_COLORS, h.color),
      onSave: (v, el) => { h.title = v; h.color = picked(el, 'pickColor', h.color); },
      onDelete: () => { S.habits = S.habits.filter(x => x !== h); },
    });
  },

  focusMins(b) { S.focus.mins = Number(b.dataset.m); save(); render(); },
  focusStart() {
    const total = S.focus.mins * 60;
    S.focus.run = { endAt: Date.now() + total * 1000, total, mins: S.focus.mins, questId: S.focus.questId, pausedLeft: null };
    save(); render(); buzz(20);
  },
  focusPause() {
    const r = S.focus.run; if (!r) return;
    if (r.pausedLeft != null) { r.endAt = Date.now() + r.pausedLeft * 1000; r.pausedLeft = null; }
    else r.pausedLeft = focusLeft();
    save(); render();
  },
  focusStop(b) {
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.innerHTML = 'Tap again to stop'; return; }
    S.focus.run = null; save(); render();
  },

  toggleZone(b) { const z = S.zones.find(x => x.id === b.dataset.id); z.open = !z.open; save(); render(); },
  toggleClean(b) {
    const z = S.zones.find(x => x.id === b.dataset.z), k = z.tasks.find(x => x.id === b.dataset.id);
    const t = dayKey();
    if (k.last === t) { k.last = k.prev || null; k.prev = null; S.stats.clean = Math.max(0, S.stats.clean - 1); revoke(XP.clean); }
    else { k.prev = k.last; k.last = t; S.stats.clean++; award(XP.clean, b); }
    save(); render(); checkBadges();
  },
  quickClean() {
    const t = dayKey();
    const pool = [];
    S.zones.forEach(z => z.tasks.forEach(k => { if (k.last !== t) pool.push({ z, k, age: k.last ? daysBetween(k.last, t) : 999 }); }));
    if (!pool.length) { toast('Everything is done today'); confetti(); return; }
    pool.sort((a, b) => b.age - a.age);
    const top = pool.slice(0, Math.min(4, pool.length));
    const pick = top[Math.floor(Math.random() * top.length)];
    sheet(`<div style="text-align:center">
      <div class="zone-ic" style="width:64px;height:64px;border-radius:18px;margin:6px auto 12px">${icon(pick.z.icon)}</div>
      <p class="sub" style="margin:0">Your 5-minute mission · ${esc(pick.z.name)}</p>
      <h3 style="margin:6px 0 4px">${esc(pick.k.title)}</h3>
      <p class="sub">${lastLabel(pick.k.last)}</p></div>
      <div class="btn-row"><button class="btn ghost" data-act="quickClean">${icon('refresh')} Another</button>
      <button class="btn" data-act="quickDone" data-z="${pick.z.id}" data-id="${pick.k.id}">${icon('check')} Done +${XP.clean}</button></div>`);
  },
  quickDone(b) { closeSheet(); ACTIONS.toggleClean(b); },
  addClean(b) {
    const z = S.zones.find(x => x.id === b.dataset.z);
    simpleSheet({ title: 'New task in ' + esc(z.name), sub: 'Something you can finish in about 5 minutes.', placeholder: 'Wipe the mirror', saveLabel: 'Add task',
      onSave: v => { z.tasks.push({ id: uid(), title: v, last: null, prev: null }); } });
  },
  editClean(b) {
    const z = S.zones.find(x => x.id === b.dataset.z), k = z.tasks.find(x => x.id === b.dataset.id);
    simpleSheet({ title: 'Edit task', value: k.title, placeholder: 'Task name',
      onSave: v => { k.title = v; }, onDelete: () => { z.tasks = z.tasks.filter(x => x !== k); } });
  },
  addZone() {
    simpleSheet({ title: 'New zone', placeholder: 'Laundry corner', extra: iconPicker(ZONE_ICONS, 'home'), saveLabel: 'Add zone',
      onSave: (v, el) => { S.zones.push({ id: uid(), name: v, icon: picked(el, 'pickIcon', 'home'), open: true, tasks: [] }); } });
  },
  editZone(b) {
    const z = S.zones.find(x => x.id === b.dataset.z);
    simpleSheet({ title: 'Edit zone', value: z.name, placeholder: 'Zone name', extra: iconPicker(ZONE_ICONS, z.icon),
      onSave: (v, el) => { z.name = v; z.icon = picked(el, 'pickIcon', z.icon); },
      onDelete: () => { S.zones = S.zones.filter(x => x !== z); } });
  },

  redeem(b) {
    const r = S.rewards.find(x => x.id === b.dataset.id);
    if (S.coins < r.cost) { toast(`${r.cost - S.coins} more coins to go`); return; }
    sheet(`<div style="text-align:center"><div class="reward-ic" style="width:64px;height:64px;border-radius:18px;margin:6px auto 12px">${icon(r.icon)}</div>
      <h3>${esc(r.title)}</h3><p class="sub">Spend ${r.cost} coins? You'll have ${S.coins - r.cost} left.</p></div>
      <div class="btn-row"><button class="btn ghost" data-act="close">Not yet</button><button class="btn" data-act="redeemYes" data-id="${r.id}">Claim it</button></div>`);
  },
  redeemYes(b) {
    const r = S.rewards.find(x => x.id === b.dataset.id);
    S.coins -= r.cost; S.stats.rewards++; save(); closeSheet(); render(); confetti(100); buzz([30, 50, 30]);
    toast('Enjoy it. You earned this.'); checkBadges();
  },
  addReward() {
    simpleSheet({ title: 'New reward', sub: 'Something you truly look forward to.', placeholder: 'Evening walk',
      extra: `<label class="lbl" for="rCost">Cost in coins</label><input class="field" id="rCost" type="number" min="10" max="5000" step="10" value="100">` + iconPicker(REWARD_ICONS, 'gift'),
      saveLabel: 'Add reward',
      onSave: (v, el) => {
        const c = Math.round(Number(el.querySelector('#rCost').value));
        if (!(c >= 10)) { el.querySelector('#sErr').textContent = 'Set a cost of at least 10 coins'; return false; }
        S.rewards.push({ id: uid(), title: v, cost: c, icon: picked(el, 'pickIcon', 'gift') });
      } });
  },
  editReward(b) {
    const r = S.rewards.find(x => x.id === b.dataset.id);
    simpleSheet({ title: 'Edit reward', value: r.title, placeholder: 'Reward name',
      extra: `<label class="lbl" for="rCost">Cost in coins</label><input class="field" id="rCost" type="number" min="10" max="5000" step="10" value="${r.cost}">` + iconPicker(REWARD_ICONS, r.icon),
      onSave: (v, el) => {
        const c = Math.round(Number(el.querySelector('#rCost').value));
        if (!(c >= 10)) { el.querySelector('#sErr').textContent = 'Set a cost of at least 10 coins'; return false; }
        r.title = v; r.cost = c; r.icon = picked(el, 'pickIcon', r.icon);
      },
      onDelete: () => { S.rewards = S.rewards.filter(x => x !== r); } });
  },

  setTheme(b) { S.settings.theme = b.dataset.id; save(); render(); },
  toggleAutoNight() { S.settings.autoNight = !S.settings.autoNight; save(); render(); },
  toggleMotion() { S.settings.reduceMotion = !S.settings.reduceMotion; save(); render(); },
  toggleVibrate() { S.settings.vibrate = !S.settings.vibrate; save(); render(); buzz(30); },
  editProfile() {
    simpleSheet({ title: 'Your profile', value: S.profile.name, placeholder: 'Your name',
      onSave: v => { S.profile.name = v.slice(0, 24); } });
  },
  ranks() {
    const L = levelInfo(S.xpTotal);
    sheet(`<h3>Ranks</h3><p class="sub">Level up to unlock the next emblem. You have ${S.xpTotal} XP.</p>
      ${RANKS.map((r, i) => { const lv = i + 1, got = lv <= L.level, cur = lv === L.level;
        return `<div class="rank-row ${cur ? 'cur' : ''} ${got ? '' : 'locked'}">${rankEmblem(lv, 60, { locked: !got })}
          <div class="grow"><b>${esc(r.name)}</b><small>Level ${lv} · ${METALS[r.metal].name}</small></div>
          <span class="rank-state">${cur ? 'You are here' : got ? icon('check') : xpToReach(lv) + ' XP'}</span></div>`; }).join('')}
      <button class="btn" style="margin-top:12px" data-act="close">Close</button>`);
  },
  async install() {
    if (isStandalone()) { toast('Already installed'); return; }
    if (installEvt) {
      const evt = installEvt; installEvt = null;
      evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome !== 'accepted') toast('No problem. You can install it any time from Settings.');
      render(); return;
    }
    sheet(`<h3>Install Quest Planner</h3><p class="sub">Takes 10 seconds. Then open it from your home screen, even offline.</p>
      ${installGuide()}<button class="btn" style="margin-top:12px" data-act="close">Got it</button>`);
  },
  installLater() { S.installSnooze = dayKey(); save(); render(); },
  exportData() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quest-planner-backup-${dayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Backup file saved');
  },
  importData() { $('#importFile').click(); },
  resetAll(b) {
    sheet(`<h3>Erase everything?</h3><p class="sub">This deletes all quests, habits, XP, and settings on this device. Save a backup first if you might want it back.</p>
      <div class="btn-row"><button class="btn ghost" data-act="close">Keep my data</button><button class="btn danger" data-act="resetYes">Erase</button></div>`);
  },
  resetYes() {
    const keep = S.unlocked;
    S = defaultState(); S.unlocked = keep; obStep = 1; save(); closeSheet(); render();
  },
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const fn = ACTIONS[b.dataset.act];
  if (fn) fn(b, e);
});
document.addEventListener('change', e => {
  if (e.target.id === 'focusQuest') { S.focus.questId = e.target.value; save(); }
  if (e.target.id === 'importFile' && e.target.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || typeof data !== 'object' || !Array.isArray(data.quests)) throw new Error('bad file');
        S = Object.assign(defaultState(), data, { unlocked: true, onboarded: true });
        save(); render(); toast('Backup restored');
      } catch (err) { toast("That file isn't a Quest Planner backup"); }
    };
    r.readAsText(e.target.files[0]);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'codeInput') ACTIONS.unlock();
  if (e.key === 'Enter' && e.target.id === 'obName') ACTIONS.obNext();
  if (e.key === 'Enter' && e.target.id === 'dumpInput') ACTIONS.dumpAdd();
  if (e.key === 'Escape') closeSheet();
});
document.addEventListener('input', e => { if (e.target.id === 'codeInput') $('#codeErr').textContent = ''; });

/* ---------- Focus ticking ---------- */
function tick() {
  if (rollover() && S.unlocked && S.onboarded) render();
  const r = S.focus.run;
  if (!r || r.pausedLeft != null) return;
  const left = focusLeft();
  if (left <= 0) {
    const gain = FOCUS_XP[r.mins] || 15;
    S.focus.run = null;
    S.stats.focus++; S.stats.focusMin += r.mins;
    award(gain);
    save(); render(); confetti(100); buzz([200, 100, 200, 100, 300]);
    sheet(`<div class="levelup"><div class="logo">${icon('hourglass')}</div><h3>Session complete</h3>
      <p class="sub">${r.mins} focused minutes. +${gain} XP.</p><p class="sub">Take a short break, stretch, drink some water.</p>
      <button class="btn" data-act="close">Done</button></div>`);
    checkBadges();
    return;
  }
  if (S.route === 'focus') {
    const t = $('#ringTime'), p = $('#ringProg');
    if (t) t.textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
    if (p) { const C = 2 * Math.PI * 106; p.setAttribute('stroke-dashoffset', C * (1 - (r.total - left) / r.total)); }
  }
}
setInterval(tick, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

/* ---------- Boot ---------- */
rollover();
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}
