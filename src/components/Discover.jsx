import React, { useState, useRef, useEffect } from 'react';
import { fetchSuggestions } from '../utils/api';

export default function Discover({ favorites }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);
  const [cooldown, setCooldown] = useState(0); // seconds remaining
  const inFlight = useRef(false);
  const cooldownTimer = useRef(null);

  // Countdown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownTimer.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(cooldownTimer.current);
  }, [cooldown]);

  const favList = Object.values(favorites);

  const handleGenerate = async () => {
    if (inFlight.current || cooldown > 0) return;
    inFlight.current = true;
    setLoading(true);
    setError('');
    try {
      const results = await fetchSuggestions(favList);
      setSuggestions(results);
      setGenerated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      inFlight.current = false;
      setLoading(false);
      setCooldown(10); // 10s cooldown after every request
    }
  };

  return (
    <div className="discover-page">
      {/* Header */}
      <div className="discover-header">
        <div className="discover-header-text">
          <h2 className="discover-title">Discover new recipes</h2>
          <p className="discover-subtitle">
            {favList.length > 0
              ? `Based on your ${favList.length} saved favorite${favList.length !== 1 ? 's' : ''}`
              : 'Save some favorites first so we can tailor suggestions to your taste'}
          </p>
        </div>
        <button
          className="generate-btn"
          onClick={handleGenerate}
          disabled={loading || cooldown > 0 || favList.length === 0}
        >
          {loading ? (
            <><span className="spinner" /> Thinking…</>
          ) : cooldown > 0 ? (
            `Wait ${cooldown}s…`
          ) : generated ? (
            '↺ Regenerate'
          ) : (
            '✦ Suggest 10 recipes'
          )}
        </button>
      </div>

      {error && <div className="discover-error">{error}</div>}

      {/* Empty / no favorites state */}
      {!generated && !loading && favList.length === 0 && (
        <div className="empty-state">
          <p className="empty-icon">🔍</p>
          <p className="empty-title">No favorites yet</p>
          <p className="empty-desc">Head to the Favorites tab and save some recipes you enjoy — then come back here for personalized suggestions.</p>
        </div>
      )}

      {/* Prompt before first generate */}
      {!generated && !loading && favList.length > 0 && (
        <div className="empty-state">
          <p className="empty-icon">✨</p>
          <p className="empty-title">Ready to explore</p>
          <p className="empty-desc">Hit the button above to get 10 recipe ideas tailored to your taste.</p>
        </div>
      )}

      {/* Suggestion cards */}
      {suggestions.length > 0 && (
        <div className="suggestions-grid">
          {suggestions.map((s, i) => (
            <SuggestionCard key={i} suggestion={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion }) {
  const nytUrl = `https://cooking.nytimes.com/search?q=${encodeURIComponent(suggestion.name)}`;

  return (
    <div className="suggestion-card">
      <div className="suggestion-card-body">
        <p className="suggestion-name">{suggestion.name}</p>
        <p className="suggestion-desc">{suggestion.description}</p>
        {suggestion.keyIngredients?.length > 0 && (
          <div className="suggestion-ingredients">
            {suggestion.keyIngredients.map((ing, i) => (
              <span key={i} className="suggestion-tag">{ing}</span>
            ))}
          </div>
        )}
      </div>
      <a
        href={nytUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="suggestion-link"
      >
        Search NYT Cooking ↗
      </a>
    </div>
  );
}
