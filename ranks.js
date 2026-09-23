'use strict';

/* ---------- Ranks: one emblem per level, drawn as SVG (no images, works offline) ---------- */
const METALS = {
  bronze:   { name: 'Bronze',   hi: '#FFD2A6', mid: '#D08A4E', lo: '#8A4B1C' },
  silver:   { name: 'Silver',   hi: '#FFFFFF', mid: '#BCC5D2', lo: '#6B7585' },
  gold:     { name: 'Gold',     hi: '#FFF1B8', mid: '#F5B82E', lo: '#9A6400' },
  emerald:  { name: 'Emerald',  hi: '#B8F7D6', mid: '#1FB870', lo: '#0A6038' },
  sapphire: { name: 'Sapphire', hi: '#BFE2FF', mid: '#2F7BFF', lo: '#143A94' },
  amethyst: { name: 'Amethyst', hi: '#EBCBFF', mid: '#9B30D9', lo: '#551380' },
  ruby:     { name: 'Ruby',     hi: '#FFC2D0', mid: '#F02452', lo: '#8C0C2A' },
  diamond:  { name: 'Diamond',  hi: '#FFFFFF', mid: '#86E3FF', lo: '#2A86AD' },
};

const RANKS = [
  { name: 'Rookie',         metal: 'bronze',   shape: 'circle', stars: 0 },
  { name: 'Starter',        metal: 'bronze',   shape: 'shield', stars: 1 },
  { name: 'Explorer',       metal: 'bronze',   shape: 'shield', stars: 2 },
  { name: 'Pathfinder',     metal: 'silver',   shape: 'shield', stars: 1 },
  { name: 'Focus Knight',   metal: 'silver',   shape: 'shield', stars: 2, laurel: true },
  { name: 'Task Ranger',    metal: 'gold',     shape: 'shield', stars: 1, laurel: true },
  { name: 'Habit Builder',  metal: 'gold',     shape: 'shield', stars: 3, laurel: true },
  { name: 'Time Keeper',    metal: 'emerald',  shape: 'hex',    gem: true, laurel: true },
  { name: 'Momentum Maker', metal: 'sapphire', shape: 'hex',    gem: true, laurel: true },
  { name: 'Quest Master',   metal: 'amethyst', shape: 'star',   gem: true, laurel: true, crown: true },
  { name: 'Time Master',    metal: 'ruby',     shape: 'star',   gem: true, laurel: true, crown: true },
  { name: 'Legend',         metal: 'diamond',  shape: 'star',   gem: true, laurel: true, crown: true, rays: true },
];

const rankFor = level => RANKS[Math.min(level, RANKS.length) - 1];
const tierName = level => METALS[rankFor(level).metal].name;
// Total XP needed to reach a level (level 1 = 0 XP)
function xpToReach(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += 100 + (l - 1) * 50;
  return total;
}

let emblemSeq = 0;
function rankEmblem(level, size = 48, { locked = false } = {}) {
  const r = rankFor(level), m = METALS[r.metal], id = 'rk' + (++emblemSeq);
  const pts = (n, R, rr, cx = 50, cy = 52, rot = -90) => [...Array(n * 2)].map((_, i) => {
    const a = (rot + i * 180 / n) * Math.PI / 180, rad = i % 2 ? rr : R;
    return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`;
  }).join(' ');
  const shapes = {
    circle: `<circle cx="50" cy="52" r="33"/>`,
    shield: `<path d="M50 16 L80 26 V50 C80 70 67 82 50 89 C33 82 20 70 20 50 V26 Z"/>`,
    hex: `<polygon points="${[...Array(6)].map((_, i) => { const a = (i * 60 - 90) * Math.PI / 180; return `${(50 + Math.cos(a) * 36).toFixed(1)},${(52 + Math.sin(a) * 36).toFixed(1)}`; }).join(' ')}"/>`,
    star: `<polygon points="${pts(8, 39, 31)}"/>`,
  };
  const star = (cx, cy, s) => `<polygon points="${pts(5, s, s * 0.45, cx, cy)}" fill="#FFF7D6" stroke="${m.lo}" stroke-width="1.2"/>`;
  // Laurel branch on the right side, curving from the bottom up; mirrored for the left
  const branch = [...Array(6)].map((_, i) => {
    const t = 78 - i * 17, a = t * Math.PI / 180, x = 50 + Math.cos(a) * 41, y = 54 + Math.sin(a) * 41;
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.4" ry="7.5" transform="rotate(${(t + 25).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }).join('');
  const leaves = side => side > 0 ? branch : `<g transform="translate(100 0) scale(-1 1)">${branch}</g>`;
  const starsRow = r.stars ? [...Array(r.stars)].map((_, i) => star(50 + (i - (r.stars - 1) / 2) * 13, 76, 5.2)).join('') : '';
  const center = r.gem
    ? `<polygon points="50,36 63,48 50,66 37,48" fill="url(#${id}g)" stroke="#fff" stroke-width="1.5"/><polyline points="37,48 63,48" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/><polyline points="44,48 50,36 56,48 50,66 44,48" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1"/>`
    : `<text x="50" y="${r.stars ? 60 : 63}" text-anchor="middle" font-family="Nunito, system-ui, sans-serif" font-weight="900" font-size="${level > 9 ? 24 : 28}" fill="#fff" stroke="${m.lo}" stroke-width="3" paint-order="stroke">${level}</text>`;
  return `<svg class="emblem${locked ? ' locked' : ''}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="${id}f" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset=".55" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${m.mid}"/></linearGradient>
    </defs>
    ${r.rays ? `<g fill="#FFE27A" opacity=".85">${[...Array(12)].map((_, i) => `<polygon points="50,52 47,6 53,6" transform="rotate(${i * 30} 50 52)"/>`).join('')}</g>` : ''}
    ${r.laurel ? `<g fill="${r.metal === 'silver' || r.metal === 'bronze' ? m.mid : '#F5B82E'}" stroke="${r.metal === 'silver' || r.metal === 'bronze' ? m.lo : '#9A6400'}" stroke-width=".8">${leaves(1)}${leaves(-1)}</g>` : ''}
    <g fill="url(#${id}f)" stroke="${m.lo}" stroke-width="3" stroke-linejoin="round">${shapes[r.shape]}</g>
    <g fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" transform="translate(50 52) scale(.78) translate(-50 -52)">${shapes[r.shape]}</g>
    <ellipse cx="40" cy="34" rx="12" ry="5" fill="#fff" opacity=".35" transform="rotate(-25 40 34)"/>
    ${center}${starsRow}
    ${r.crown ? `<path d="M36 17 L40 7 L45 13 L50 4 L55 13 L60 7 L64 17 Z" fill="#FFD447" stroke="#9A6400" stroke-width="1.6" stroke-linejoin="round"/><circle cx="50" cy="12" r="1.8" fill="#F02452"/>` : ''}
  </svg>`;
}
