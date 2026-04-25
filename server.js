const express = require('express');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

const DEFAULT_DATA = {
  weeklyPlan: {},
  recipes: {},
  shoppingOverrides: {},
  manualItems: {},
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    return DEFAULT_DATA;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return DEFAULT_DATA;
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// CORS for Vite dev server
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// --- Data endpoints ---

app.get('/api/data', (req, res) => {
  res.json(loadData());
});

app.put('/api/data', (req, res) => {
  try {
    saveData(req.body);
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
  // Handle @type arrays like ["Recipe", "Thing"]
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

    // Normalize image
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

    // Normalize servings
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

// Serve built frontend in production (after all /api routes)
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
