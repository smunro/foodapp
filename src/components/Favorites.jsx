import React, { useState, useRef, useEffect } from 'react';
import { fetchRecipe } from '../utils/api';

function isInstagramUrl(url) {
  return /instagram\.com\/(reel|p|tv)\//.test(url);
}

export default function Favorites({ favorites, onAdd, onRemove }) {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [showCaption, setShowCaption] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const captionRef = useRef(null);

  useEffect(() => {
    if (showCaption) captionRef.current?.focus();
  }, [showCaption]);

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setUrl(val);
    if (!isInstagramUrl(val)) {
      setShowCaption(false);
      setCaption('');
    }
  };

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const recipe = await fetchRecipe(trimmed, caption.trim() || undefined);
      onAdd({ ...recipe, id: crypto.randomUUID(), savedAt: new Date().toISOString() });
      setUrl('');
      setCaption('');
      setShowCaption(false);
      inputRef.current?.focus();
    } catch (err) {
      if (err.code === 'INSTAGRAM_PASTE_CAPTION') {
        setShowCaption(true);
        setError('');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const items = Object.values(favorites).sort(
    (a, b) => new Date(b.savedAt) - new Date(a.savedAt)
  );

  return (
    <div className="favorites-page">
      {/* Add recipe */}
      <div className="fav-add-card">
        <label className="fav-add-label">Save a recipe to your favorites</label>
        <div className="fav-add-row">
          <input
            ref={inputRef}
            type="url"
            className="url-input"
            placeholder="Paste any recipe URL or Instagram Reel link…"
            value={url}
            onChange={handleUrlChange}
            onKeyDown={(e) => e.key === 'Enter' && !showCaption && handleSave()}
          />
          {!showCaption && (
            <button
              className="fetch-btn"
              onClick={handleSave}
              disabled={loading || !url.trim()}
            >
              {loading ? <span className="spinner" /> : 'Save'}
            </button>
          )}
        </div>
        {showCaption && (
          <div className="caption-paste-box">
            <p className="caption-paste-label">
              Instagram blocked the request. Open the reel, tap <strong>···</strong> → <strong>Copy caption</strong>, then paste it below:
            </p>
            <textarea
              ref={captionRef}
              className="caption-textarea"
              placeholder="Paste the reel caption here…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
            />
            <button
              className="fetch-btn"
              onClick={handleSave}
              disabled={loading || !caption.trim()}
            >
              {loading ? <span className="spinner" /> : 'Extract Recipe'}
            </button>
          </div>
        )}
        {error && <p className="fetch-error">{error}</p>}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="empty-state">
          <p className="empty-icon">⭐</p>
          <p className="empty-title">No favorites yet</p>
          <p className="empty-desc">Paste any recipe URL above to save it here.</p>
        </div>
      )}

      {/* Favorites grid */}
      {items.length > 0 && (
        <div className="fav-grid">
          {items.map((recipe) => (
            <FavCard key={recipe.id} recipe={recipe} onRemove={() => onRemove(recipe.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FavCard({ recipe, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const hasFullRecipe = recipe.ingredients?.length > 0 || recipe.instructions?.length > 0;

  return (
    <div className="fav-card">
      {recipe.image ? (
        <img
          src={recipe.image}
          alt={recipe.name}
          className="fav-card-img"
          onError={(e) => (e.target.style.display = 'none')}
        />
      ) : (
        <div className="fav-card-img-placeholder">🍽</div>
      )}
      <div className="fav-card-body">
        <p className="fav-card-name">{recipe.name}</p>
        {recipe.ingredients?.length > 0 && (
          <p className="fav-card-meta">{recipe.ingredients.length} ingredients</p>
        )}
        <div className="fav-card-actions">
          {recipe.url && (
            <a
              href={recipe.url}
              target="_blank"
              rel="noopener noreferrer"
              className="fav-card-link"
            >
              Open recipe ↗
            </a>
          )}
          {hasFullRecipe && (
            <button
              className="fav-card-link"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Hide recipe' : 'View recipe'}
            </button>
          )}
          <button className="fav-card-remove" onClick={onRemove} title="Remove from favorites">
            Remove
          </button>
        </div>

        {expanded && (
          <div className="fav-recipe-detail">
            {recipe.servings && (
              <p className="fav-recipe-servings">Serves {recipe.servings}</p>
            )}
            {recipe.ingredients?.length > 0 && (
              <div className="fav-recipe-section">
                <p className="fav-recipe-section-title">Ingredients</p>
                <ul className="fav-recipe-list">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i}>{ing}</li>
                  ))}
                </ul>
              </div>
            )}
            {recipe.instructions?.length > 0 && (
              <div className="fav-recipe-section">
                <p className="fav-recipe-section-title">Instructions</p>
                <ol className="fav-recipe-list">
                  {recipe.instructions.map((step, i) => (
                    <li key={i}>{step.replace(/^step\s*\d+[:.]\s*/i, '')}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
