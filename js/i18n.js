// ---------- language: Spanish is the source text; English comes from assets/i18n/en.json on demand ----------
let LANG = 'es';
try {
  LANG = localStorage.getItem('rkLang') === 'en' ? 'en' : 'es';
} catch (e) {}

let EN = null;
let loadingEn = null;

export function getLang() {
  return LANG;
}

export function setLangCode(lang) {
  LANG = lang === 'en' ? 'en' : 'es';
  try {
    localStorage.setItem('rkLang', LANG);
  } catch (e) {}
}

export async function loadLang(lang = LANG) {
  if (lang !== 'en' || EN) return;
  if (!loadingEn) {
    loadingEn = fetch('assets/i18n/en.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load en.json: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        EN = data;
      })
      .catch((err) => {
        console.warn('i18n load error:', err);
        EN = {};
      })
      .finally(() => {
        loadingEn = null;
      });
  }
  await loadingEn;
}

export function tr(s) {
  if (LANG === 'es' || typeof s !== 'string' || !s || !EN) return s;
  let e = EN[s];
  if (e != null) return e;
  let m = /^(RESCUE \d+): (.+) a (\d+) NM al (este|oeste)\. ↑ para despegar\.$/.exec(s);
  if (m) return `${m[1]}: ${tr(m[2])} ${m[3]} NM to the ${m[4] === 'este' ? 'east' : 'west'}. ↑ to take off.`;
  m = /^El (.+) se ha hundido\.$/.exec(s);
  if (m) return `The ${tr(m[1])} has sunk.`;
  const nums = [];
  const k = s.replace(/\d+(?:[.:]\d+)*/g, (q) => {
    nums.push(q);
    return '#';
  });
  e = EN[k];
  if (e == null) return s;
  let i = 0;
  return e.replace(/#/g, () => nums[i++]);
}

export function applyLang(root) {
  document.documentElement.lang = LANG;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (n.__es === undefined) {
      if (!n.nodeValue.trim()) continue;
      n.__es = n.nodeValue;
    }
    const o = n.__es;
    const q = o.trim();
    n.nodeValue = LANG === 'es' ? o : o.replace(q, tr(q));
  }
}
