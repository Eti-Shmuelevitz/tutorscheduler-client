// A stable hue per subject, so the same subject looks the same on cards, in
// the calendar and in lists. The server only knows names, so common subjects
// are matched by keyword (to keep them apart) with a hash as the fallback.

const KNOWN = [
  { match: /מתמטיק|חשבון|גאומטר|אלגבר|math/i, hue: 235 },
  { match: /אנגלית|english/i, hue: 205 },
  { match: /פיזיק|physic/i, hue: 265 },
  { match: /כימי|chem/i, hue: 170 },
  { match: /ביולוג|bio/i, hue: 140 },
  { match: /היסטור|history/i, hue: 28 },
  { match: /אדריכל|architect/i, hue: 55 },
  { match: /דקדוק|grammar/i, hue: 300 },
  { match: /תנ"?ך|ספרות|לשון|עברית|hebrew/i, hue: 12 },
  { match: /תכנות|מחשב|code|program|comput/i, hue: 190 },
  { match: /מוזיק|פסנתר|גיטר|music|piano/i, hue: 320 },
  { match: /אמנות|ציור|art/i, hue: 340 },
]

export function subjectHue(name = '') {
  const known = KNOWN.find((k) => k.match.test(name))
  if (known) return known.hue
  return [...name].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7) % 360
}

// Inline style that exposes the hue to CSS (see .subject-tinted in index.css).
export function subjectStyle(name) {
  return { '--hue': subjectHue(name) }
}
