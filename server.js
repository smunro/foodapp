require('dotenv').config();

const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// --- Supabase setup ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const DEFAULT_DATA = {
  weeklyPlan: {},
  recipes: {},
  shoppingOverrides: {},
  manualItems: {},
};

async function loadData() {
  const { data, error } = await supabase
    .from('app_data')
    .select('data')
    .eq('id', 'main')
    .single();

  if (error) {
    console.error('[Supabase] loadData error:', error.message, error.code, error.details);
    return DEFAULT_DATA;
  }
  if (!data) {
    console.warn('[Supabase] loadData: no row found, returning defaults');
    return DEFAULT_DATA;
  }
  return data.data;
}

async function saveData(appData) {
  const { error } = await supabase
    .from('app_data')
    .upsert({ id: 'main', data: appData });

  if (error) {
    console.error('[Supabase] saveData error:', error.message, error.code, error.details);
    throw new Error(error.message);
  }
}

// --- Express setup ---
const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// --- Data endpoints ---

app.get('/api/data', async (req, res) => {
  try {
    res.json(await loadData());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/data', async (req, res) => {
  try {
    await saveData(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Recipe fetching ---

function isInstagramUrl(url) {
  return /instagram\.com\/(reel|p|tv)\//.test(url);
}

async function fetchInstagramRecipe(url, geminiKey) {
  if (!geminiKey) {
    const err = new Error('GEMINI_KEY is required to extract recipes from Instagram.');
    err.status = 500;
    throw err;
  }

  let html;
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      timeout: 15000,
      maxRedirects: 3,
    });
    html = response.data;
  } catch (err) {
    const status = err.response?.status;
    if (status === 403 || status === 401) {
      const e = new Error('Could not access this Instagram post — it may be private or Instagram is blocking the request.');
      e.status = 422;
      throw e;
    }
    throw err;
  }

  const $ = cheerio.load(html);
  const caption = $('meta[property="og:description"]').attr('content') || '';
  const image = $('meta[property="og:image"]').attr('content') || '';

  if (!caption.trim()) {
    const e = new Error('Could not read caption from this Instagram post.');
    e.status = 422;
    throw e;
  }

  const prompt = `The following text is from an Instagram post caption. If it contains a recipe, extract it and generate clear step-by-step cooking instructions from any method hints in the caption.
Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{"hasRecipe":true,"name":"...","description":"...","servings":"...","ingredients":["..."],"instructions":["Step 1: ...","Step 2: ..."]}

If no recipe is present, return: {"hasRecipe":false}

Caption:
${caption}`;

  const geminiResponse = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    { contents: [{ parts: [{ text: prompt }] }] },
    { timeout: 20000 }
  );

  const raw = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const e = new Error('Received an unexpected response from Gemini. Try again.');
    e.status = 500;
    throw e;
  }

  if (!parsed.hasRecipe) {
    const e = new Error("No recipe found in this Instagram reel's caption.");
    e.status = 422;
    throw e;
  }

  return {
    name: String(parsed.name || 'Instagram Recipe').trim(),
    url,
    image,
    description: String(parsed.description || '').trim(),
    servings: String(parsed.servings || '').trim(),
    ingredients: (parsed.ingredients || []).filter((s) => s && s.trim()),
    instructions: (parsed.instructions || []).filter((s) => s && s.trim()),
  };
}

function findRecipe(obj) {
  if (!obj) return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof obj !== 'object') return null;
  if (obj['@type'] === 'Recipe') return obj;
  if (Array.isArray(obj['@type']) && obj['@type'].includes('Recipe')) return obj;
  if (obj['@graph']) return findRecipe(obj['@graph']);
  return null;
}

app.get('/api/recipe', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  if (isInstagramUrl(url)) {
    try {
      const recipe = await fetchInstagramRecipe(url, process.env.GEMINI_KEY);
      return res.json(recipe);
    } catch (err) {
      const status = err.status || (err.response?.status === 429 ? 500 : 500);
      return res.status(status).json({ error: err.message });
    }
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    let recipeData = null;

    $('script[type="application/ld+json"]').each((_, el) => {
      if (recipeData) return;
      try {
        const parsed = JSON.parse($(el).html());
        recipeData = findRecipe(parsed);
      } catch {
        // ignore malformed JSON-LD
      }
    });

    if (!recipeData) {
      return res.status(422).json({
        error:
          "No recipe data found on this page. The site may require you to be logged in, or doesn't use standard recipe markup.",
      });
    }

    let image = '';
    if (recipeData.image) {
      if (typeof recipeData.image === 'string') {
        image = recipeData.image;
      } else if (Array.isArray(recipeData.image)) {
        const first = recipeData.image[0];
        image = typeof first === 'string' ? first : first?.url || '';
      } else if (recipeData.image?.url) {
        image = recipeData.image.url;
      }
    }

    let servings = recipeData.recipeYield || '';
    if (Array.isArray(servings)) servings = servings[0];
    servings = String(servings).trim();

    res.json({
      name: String(recipeData.name || 'Untitled Recipe').trim(),
      url,
      image,
      description: String(recipeData.description || '').trim(),
      servings,
      ingredients: (recipeData.recipeIngredient || []).filter(
        (s) => s && s.trim()
      ),
    });
  } catch (err) {
    if (err.response?.status === 403) {
      return res.status(422).json({
        error:
          "Access denied (403). Make sure you're logged in to this site in your browser.",
      });
    }
    if (err.response?.status === 401) {
      return res.status(422).json({
        error: 'This page requires authentication. Please log in first.',
      });
    }
    res.status(500).json({ error: `Failed to fetch page: ${err.message}` });
  }
});

// --- Recipe suggestions via Gemini ---

app.post('/api/suggestions', async (req, res) => {
  const geminiKey = process.env.GEMINI_KEY;
  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_KEY is not configured. Add it as an environment variable.' });
  }

  const { favorites = [] } = req.body;
  if (!favorites.length) {
    return res.status(400).json({ error: 'Add some favorites first so we can tailor suggestions to your taste.' });
  }

  const recipeList = favorites
    .map((r) => `- ${r.name}${r.ingredients?.length ? ` (key ingredients: ${r.ingredients.slice(0, 4).join(', ')})` : ''}`)
    .join('\n');

  const prompt = `You are a culinary assistant helping someone discover new recipes to cook at home.

Based on these recipes they already enjoy:
${recipeList}

Suggest exactly 10 recipes they would likely love. Consider the cuisines, ingredients, and cooking styles they seem to enjoy.

Return ONLY a valid JSON array — no markdown fences, no explanation, just the raw JSON. Each item must have:
- "name": the recipe name (string)
- "description": 1-2 engaging sentences about the dish and why they'd enjoy it based on their taste (string)
- "keyIngredients": 3-5 key ingredients (array of strings)

Example format:
[{"name":"...","description":"...","keyIngredients":["...","..."]}]`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { timeout: 20000 }
    );

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let suggestions;
    try {
      suggestions = JSON.parse(cleaned);
    } catch {
      console.error('Gemini response was not valid JSON:', raw);
      return res.status(500).json({ error: 'Received an unexpected response from Gemini. Try again.' });
    }

    res.json({ suggestions });
  } catch (err) {
    const status = err.response?.status;
    const geminiMsg = err.response?.data?.error?.message;
    if (status === 400) {
      return res.status(500).json({ error: 'Invalid Gemini API key — double-check your GEMINI_KEY.' });
    }
    if (status === 429) {
      return res.status(500).json({ error: `Rate limited: ${geminiMsg || 'no details from Gemini'}` });
    }
    res.status(500).json({ error: `${status ?? 'unknown'}: ${geminiMsg || err.message}` });
  }
});

// --- Serve built frontend in production ---
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🍴  Meal Planner API running at http://localhost:${PORT}`);
});
