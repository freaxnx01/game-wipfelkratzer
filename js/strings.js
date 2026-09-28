/* Zweisprachigkeit de/en (#107). Deutsch ist die Ursprungssprache des Spiels
   und steht weiterhin dort, wo es hingehoert: im Markup und in js/game.js.
   Diese Datei traegt deshalb nur Englisch — plus die wenigen Vorlagen mit
   Platzhaltern, deren deutsche Fassung nicht aus dem DOM lesbar ist.
   Schnittstelle nach aussen ist i18n.js (window.GG_LANG, gg-langchange). */

/* Vorlagen: hier steht Deutsch ausnahmsweise mit, weil {n}/{max}/{fl}/{name}
   kein Textknoten sind, den applyStatic() auslesen koennte. */
const DE_VORLAGEN = {
  'fl.ground': 'E',
  'hud.nuts': '{n} Haselnüsse',
  'hud.floors': 'Erdgeschoss + {n} von {max} Stockwerken',
  'build.next': 'Stockwerk bauen ({n}/{max})',
  'build.done': 'Fertig gebaut!',
  'edit.flat': '{fl} — {teile}',
  'edit.flatEmpty': 'noch niemand',
  'edit.garten': 'Spielplatz einrichten',
  'edit.roof': 'Dachterrasse einrichten',
  'besuch.roofTitle': 'Dachterrasse',
  'besuch.outsideTitle': 'Spielplatz',
  'besuch.viewTitle': 'Aussichtsplattform',
  'toolbar.wallsAway': 'Wände weg',
  'toolbar.wallsBack': 'Wände hin',
  'toolbar.night': 'Nacht',
  'toolbar.day': 'Tag',
  'toolbar.musicOff': 'Musik aus',
  'toolbar.musicOn': 'Musik an',
};

export const EN = {
  'app.title': 'Willi builds the Treetop Scraper',

  'fl.ground': 'G',
  'hud.nuts': '{n} hazelnuts',
  'hud.floors': 'Ground floor + {n} of {max} storeys',
  'build.next': 'Build a floor ({n}/{max})',
  'build.done': 'All done!',
  'edit.flat': '{fl} — {teile}',
  'edit.flatEmpty': 'no one yet',
  'edit.garten': 'Furnish the playground',
  'edit.roof': 'Furnish the roof terrace',
  'besuch.roofTitle': 'Roof terrace',
  'besuch.outsideTitle': 'Playground',
  'besuch.viewTitle': 'Lookout platform',
  'toolbar.wallsAway': 'Walls away',
  'toolbar.wallsBack': 'Walls back',
  'toolbar.night': 'Night',
  'toolbar.day': 'Day',
  'toolbar.musicOff': 'Music off',
  'toolbar.musicOn': 'Music on',

  'toolbar.catalog': 'Furnish',
  'toolbar.staende': 'Forest map',
  'toolbar.extras': 'Extras',
  'toolbar.besuch': 'Go inside',
  'toolbar.photo': 'Photo',

  'extras.bridge': 'Build a bridge',
  'extras.garden': 'Garden & playground',
  'extras.sign': 'Resident sign',
  'extras.animals': 'All the animals',
  'extras.gallery': 'Photo gallery',
  'extras.party': 'Throw a roof party!',

  'edit.placeholder': 'Name this flat',
  'edit.nameTitle': 'Give this flat a name',
  'edit.clear': 'Clear it all out',
  'edit.random': 'Furnish at random',
  'edit.copy': 'Copy room',
  'edit.paste': 'Paste room',
  'edit.tip': 'Hint',
  'edit.done': 'Done',

  'besuch.down': 'one floor down',
  'besuch.up': 'one floor up',
  'besuch.roof': 'Roof',
  'besuch.outside': 'Outside',
  'besuch.view': 'Lookout',
  'besuch.close': 'Leave',

  'sel.move': 'Move',
  'sel.turn': 'Turn',
  'sel.stretch': 'Stretch',
  'sel.stretchAria': 'Change length',
  'sel.shorter': 'Shorter',
  'sel.longer': 'Longer',
  'sel.up': 'Up',
  'sel.left': 'Left',
  'sel.down': 'Down',
  'sel.right': 'Right',
  'sel.color': 'Colour',
  'sel.colorAria': 'Pick a colour',
  'sel.size': 'Size',
  'sel.sizeAria': 'Pick a size',
  'sel.delete': 'Remove',

  'dlg.close': 'Close',
  'dlg.closeAll': 'Close all',

  'dlg.catalog.title': 'Furnishings',

  'dlg.residents.title': 'Treetop Scraper — Residents',

  'dlg.pasteask.title': 'Someone already lives here',
  'dlg.pasteask.add': 'Add to it',
  'dlg.pasteask.replace': 'Replace everything',
  'dlg.pasteask.cancel': 'Cancel',

  'dlg.clearask.title': 'Really clear everything out?',
  'dlg.clearask.ok': 'Yes, clear it out',
  'dlg.clearask.cancel': "I'd rather not",

  'dlg.splash.title': 'Down to the creek?',
  'dlg.splash.p1': 'You’re headed to «Splashdown!» — the water-slide race.',
  'dlg.splash.p2': 'Your Treetop Scraper stays saved and waits for you.',
  'dlg.splash.go': 'Yes, let’s slide!',
  'dlg.splash.stay': "I'd rather stay here",

  'dlg.animals.title': 'The animals of the Treetop Scraper',

  'dlg.gallery.title': 'Photo gallery',
  'dlg.gallery.downloadAll': 'Download all',

  'dlg.workshop.title': 'Workshop',
  'dlg.workshop.hint': 'Stack up to five parts. Tap a part, then pick shape, width and colour.',
  'dlg.workshop.previewAlt': 'Preview of the piece of furniture',
  'dlg.workshop.add': 'Add a part',
  'dlg.workshop.del': 'Remove part',
  'dlg.workshop.cancel': 'Cancel',
  'dlg.workshop.ok': 'Done',

  'dlg.staende.title': 'Forest map',
  'dlg.staende.full': "More than four towers don't fit. Delete one first.",
  'dlg.staende.new': 'New tower',
  'dlg.staende.import': 'Load a tower',

  'dlg.schaufenster.title': 'Wipfkea',
  'dlg.schaufenster.hint': 'This furniture is ready in the catalogue once you furnish a flat.',

  'intro.p1': 'Help Willi Beaver build the Treetop Scraper — floor by floor, all the way up!',
  'intro.p2': 'Tap a floor to furnish the flat. If a flat looks nice, animals move in — and they have wishes!',
  'intro.tip': 'Hint: tap a piece of furniture, then push it with the arrow keys and turn it with Page↑/Page↓. The pool is waiting in the catalogue under «Roof».',
  'intro.towerQuestion': 'How tall should the Treetop Scraper get?',
  'intro.tower10': 'Small tower — 10 storeys',
  'intro.tower20': 'Tall tower — 20 storeys',
  'intro.tower50': 'Giant tower — 50 storeys',
  'intro.start': "Let's go!",
  'intro.myTowers': 'My towers',

  'season.fruehling': 'Spring',
  'season.sommer': 'Summer',
  'season.herbst': 'Autumn',
  'season.winter': 'Winter',
};

const DE = {};

/* Nie ueberschreiben: beim zweiten Lauf stuende im DOM sonst Englisch, und
   das wuerde als deutscher Wert gemerkt. */
export function rememberDe(key, text) {
  if (!(key in DE) && typeof text === 'string' && text.length) DE[key] = text;
}
for (const [k, v] of Object.entries(DE_VORLAGEN)) rememberDe(k, v);

export function t(key, vars) {
  const roh = (window.GG_LANG === 'en' ? EN[key] : DE[key]) ?? DE[key] ?? EN[key] ?? key;
  return vars ? roh.replace(/\{(\w+)\}/g, (_, n) => String(vars[n] ?? '')) : roh;
}

/* Attribut -> Ziel. null heisst textContent. */
const ZIELE = [['data-i18n', null], ['data-i18n-title', 'title'],
  ['data-i18n-aria', 'aria-label'], ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-alt', 'alt']];

export function applyStatic(wurzel = document) {
  for (const [attr, ziel] of ZIELE)
    for (const el of wurzel.querySelectorAll(`[${attr}]`)) {
      const key = el.getAttribute(attr);
      rememberDe(key, ziel ? el.getAttribute(ziel) : el.textContent);
      const wert = t(key);
      if (ziel) el.setAttribute(ziel, wert); else el.textContent = wert;
    }
}

/* Ein einziger Einstiegspunkt fuer js/game.js. nachWechsel() zieht die
   Beschriftungen nach, die das Spiel selbst setzt. */
export function initI18n(nachWechsel) {
  const anwenden = () => {
    document.documentElement.lang = window.GG_LANG;
    applyStatic();
    document.title = t('app.title');
    if (nachWechsel) nachWechsel();
  };
  anwenden();
  window.addEventListener('gg-langchange', anwenden);
}
