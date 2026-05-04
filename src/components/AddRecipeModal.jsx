import React, { useState, useEffect, useRef } from 'react';
import { fetchRecipe } from '../utils/api';

const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

export default function AddRecipeModal({
  dateKey,
  mealType,
  existingRecipes,
  onAdd,
  onClose,
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState('');
  const [freeText, setFreeText] = useState('');
  const urlInputRef = useRef(null);

  useEffect(() => {
    urlInputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const recipe = await fetchRecipe(trimmed);
      setPreview({ ...recipe, id: crypto.randomUUID() });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFreeText = () => {
    const name = freeText.trim();
    if (!name) return;
    onAdd({ id: crypto.randomUUID(), name, url: '', image: '', ingredients: [], servings: '', freeText: true });
  };

  const formattedDate = new Date(dateKey + 'T12:00:00').toLocaleDateString(
    'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }
  );

  const allRecipes = Object.values(existingRecipes);
  const filtered = search.trim()
    ? allRecipes.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase())
      )
    : allRecipes;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Add Recipe</h2>
            <p className="modal-subtitle">
              {formattedDate} · {MEAL_LABELS[mealType]}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* URL Fetch */}
          <section className="modal-section">
            <label className="section-label">Paste a recipe URL</label>
            <div className="url-row">
              <input
                ref={urlInputRef}
                type="url"
                className="url-input"
                placeholder="https://cooking.nytimes.com/… or an Instagram Reel URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
              />
              <button
                className="fetch-btn"
                onClick={handleFetch}
                disabled={loading || !url.trim()}
              >
                {loading ? (
                  <span className="spinner" />
                ) : (
                  'Fetch'
                )}
              </button>
            </div>
            {error && <p className="fetch-error">{error}</p>}
          </section>

          {/* Preview */}
          {preview && (
            <div className="recipe-preview">
              <div className="recipe-preview-inner">
                {preview.image && (
                  <img
                    src={preview.image}
                    alt={preview.name}
                    className="recipe-preview-img"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                )}
                <div className="recipe-preview-info">
                  <h3 className="recipe-preview-name">{preview.name}</h3>
                  {preview.servings && (
                    <p className="recipe-meta">Serves {preview.servings}</p>
                  )}
                  <p className="recipe-meta">
                    {preview.ingredients.length} ingredient
                    {preview.ingredients.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                className="add-btn"
                onClick={() => onAdd(preview)}
              >
                Add to {MEAL_LABELS[mealType]}
              </button>
            </div>
          )}

          {/* Free-text meal */}
          <div className="modal-divider"><span>or</span></div>
          <section className="modal-section">
            <label className="section-label">Just name a meal</label>
            <div className="url-row">
              <input
                type="text"
                className="url-input"
                placeholder="e.g. Leftovers, Eating out, Mom's pasta…"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFreeText()}
              />
              <button
                className="fetch-btn"
                onClick={handleAddFreeText}
                disabled={!freeText.trim()}
              >
                Add
              </button>
            </div>
          </section>

          {/* Saved recipes */}
          {allRecipes.length > 0 && (
            <section className="modal-section">
              <label className="section-label">Or pick a saved recipe</label>
              <input
                type="text"
                className="search-input"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="saved-list">
                {filtered.length === 0 && (
                  <p className="saved-empty">No matches</p>
                )}
                {filtered.map((recipe) => (
                  <button
                    key={recipe.id}
                    className="saved-recipe-row"
                    onClick={() => onAdd(recipe)}
                  >
                    {recipe.image && (
                      <img
                        src={recipe.image}
                        alt=""
                        className="saved-recipe-img"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    )}
                    <div className="saved-recipe-info">
                      <span className="saved-recipe-name">{recipe.name}</span>
                      <span className="saved-recipe-count">
                        {recipe.ingredients.length} ingredients
                      </span>
                    </div>
                    <span className="saved-recipe-add">Add</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
