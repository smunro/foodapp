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
