const UNICODE_FRACTIONS = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3',
  '¼': '1/4', '¾': '3/4',
  '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
  '⅙': '1/6', '⅚': '5/6',
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
};

const UNIT_LOOKUP = {
  cup: 'cup', cups: 'cup', c: 'cup',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  gram: 'g', grams: 'g', g: 'g',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  milliliter: 'ml', milliliters: 'ml', ml: 'ml',
  liter: 'l', liters: 'l',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can',
  package: 'pkg', packages: 'pkg', pkg: 'pkg',
  bunch: 'bunch', bunches: 'bunch',
  head: 'head', heads: 'head',
  stalk: 'stalk', stalks: 'stalk',
  sprig: 'sprig', sprigs: 'sprig',
  slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
  handful: 'handful', handfuls: 'handful',
  inch: 'inch', inches: 'inch',
};

// Adjectives/descriptors to strip when building a grouping key
const STRIP_WORDS = new Set([
  'fresh', 'freshly', 'dried', 'frozen', 'canned', 'cooked', 'raw', 'uncooked',
  'large', 'medium', 'small', 'extra-large',
  'organic', 'homemade',
  'finely', 'roughly', 'coarsely', 'thinly', 'thickly',
  'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded',
  'ground', 'crushed', 'mashed', 'peeled', 'seeded', 'trimmed',
  'boneless', 'skinless', 'whole', 'halved', 'quartered',
  'toasted', 'roasted',
  'packed', 'lightly', 'heaping', 'generous', 'scant',
  'softened', 'melted', 'room', 'temperature',
]);

function normalizeUnicode(str) {
  let s = str;
  for (const [k, v] of Object.entries(UNICODE_FRACTIONS)) {
    s = s.replace(new RegExp(k, 'g'), ' ' + v + ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

export function parseIngredient(raw) {
  if (!raw) return { original: raw, quantity: '', unit: '', name: '', key: '' };

  let s = normalizeUnicode(raw.trim());

  // Strip parentheticals like "(14 oz)" or "(about 2 cups)"
  s = s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  // Match quantity at start: "1 1/2", "1/2", "2.5", "2"
  const qRe = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)/;
  const qMatch = s.match(qRe);
  let quantity = '';
  let rest = s;

  if (qMatch) {
    quantity = qMatch[1].trim();
    rest = s.slice(qMatch[0].length).trim();
  }

  // Match unit
  const words = rest.split(/\s+/);
  let unit = '';
  let nameWords = words;

  if (words.length > 0) {
    const candidate = words[0].toLowerCase().replace(/[.,;]$/, '');
    if (UNIT_LOOKUP[candidate]) {
      unit = UNIT_LOOKUP[candidate];
      nameWords = words.slice(1);
    }
  }

  // Build name: everything before the first comma, lowercased
  const name = nameWords
    .join(' ')
    .replace(/,.*$/, '')
    .trim()
    .toLowerCase();

  // Build grouping key: strip descriptors and crude-singularize
  const key = name
    .split(/\s+/)
    .filter((w) => !STRIP_WORDS.has(w))
    .join(' ')
    .replace(/ies$/, 'y')        // berries → berry
    .replace(/(?<=[^aeiou])s$/, '') // crude: remove trailing 's' after consonant
    .trim() || name;

  return { original: raw, quantity, unit, name, key };
}

/**
 * Group ingredients from multiple recipes.
 *
 * @param {Array<{ recipeId, recipeName, ingredients: string[] }>} recipeIngredients
 * @returns {Array<{ key, name, sources: Array<{ recipeId, recipeName, quantity, unit, original }> }>}
 */
export function groupIngredients(recipeIngredients) {
  const groups = new Map();

  for (const { recipeId, recipeName, ingredients } of recipeIngredients) {
    for (const raw of ingredients) {
      const parsed = parseIngredient(raw);
      const k = parsed.key || parsed.name || raw.toLowerCase();

      if (groups.has(k)) {
        groups.get(k).sources.push({
          recipeId,
          recipeName,
          quantity: parsed.quantity,
          unit: parsed.unit,
          original: parsed.original,
        });
      } else {
        groups.set(k, {
          key: k,
          name: parsed.name || k,
          sources: [
            {
              recipeId,
              recipeName,
              quantity: parsed.quantity,
              unit: parsed.unit,
              original: parsed.original,
            },
          ],
        });
      }
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
