import React, { useState, useEffect, useCallback } from 'react';
import WeeklyPlanner from './components/WeeklyPlanner';
import ShoppingList from './components/ShoppingList';
import Favorites from './components/Favorites';
import { fetchData, saveData } from './utils/api';
import { getWeekStart, toDateKey } from './utils/dates';

const DEFAULT_DATA = {
  weeklyPlan: {},
  recipes: {},
  shoppingOverrides: {},
  manualItems: {},
  favorites: {},
};

export default function App() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [activeTab, setActiveTab] = useState('planner');
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load on mount
  useEffect(() => {
    fetchData()
      .then(setData)
      .catch(() => setError('Could not connect to the local server. Is it running?'))
      .finally(() => setLoading(false));
  }, []);

  // Update data + auto-save
  const updateData = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveData(next).catch(console.error);
      return next;
    });
  }, []);

  // --- Meal plan operations ---

  const addRecipeToMeal = useCallback(
    (dateKey, mealType, recipe) => {
      updateData((prev) => {
        const recipes = { ...prev.recipes, [recipe.id]: recipe };
        const dayPlan = prev.weeklyPlan[dateKey] ?? {
          breakfast: [],
          lunch: [],
          dinner: [],
        };
        const slot = dayPlan[mealType] ?? [];
        if (slot.includes(recipe.id)) return { ...prev, recipes };
        return {
          ...prev,
          recipes,
          weeklyPlan: {
            ...prev.weeklyPlan,
            [dateKey]: { ...dayPlan, [mealType]: [...slot, recipe.id] },
          },
        };
      });
    },
    [updateData]
  );

  const removeRecipeFromMeal = useCallback(
    (dateKey, mealType, recipeId) => {
      updateData((prev) => ({
        ...prev,
        weeklyPlan: {
          ...prev.weeklyPlan,
          [dateKey]: {
            ...(prev.weeklyPlan[dateKey] ?? {}),
            [mealType]: (prev.weeklyPlan[dateKey]?.[mealType] ?? []).filter(
              (id) => id !== recipeId
            ),
          },
        },
      }));
    },
    [updateData]
  );

  // --- Favorites operations ---

  const addFavorite = useCallback(
    (recipe) => {
      updateData((prev) => ({
        ...prev,
        favorites: { ...prev.favorites, [recipe.id]: recipe },
      }));
    },
    [updateData]
  );

  const removeFavorite = useCallback(
    (recipeId) => {
      updateData((prev) => {
        const { [recipeId]: _, ...rest } = prev.favorites;
        return { ...prev, favorites: rest };
      });
    },
    [updateData]
  );

  // --- Shopping list operations ---

  const weekKey = toDateKey(weekStart);

  const toggleIngredient = useCallback(
    (ingredientKey) => {
      updateData((prev) => {
        const overrides = prev.shoppingOverrides[weekKey] ?? {};
        const cur = overrides[ingredientKey] ?? {};
        return {
          ...prev,
          shoppingOverrides: {
            ...prev.shoppingOverrides,
            [weekKey]: {
              ...overrides,
              [ingredientKey]: { ...cur, checked: !cur.checked },
            },
          },
        };
      });
    },
    [updateData, weekKey]
  );

  const addManualItem = useCallback(
    (text) => {
      updateData((prev) => ({
        ...prev,
        manualItems: {
          ...prev.manualItems,
          [weekKey]: [
            ...(prev.manualItems[weekKey] ?? []),
            { id: crypto.randomUUID(), text, checked: false },
          ],
        },
      }));
    },
    [updateData, weekKey]
  );

  const toggleManualItem = useCallback(
    (itemId) => {
      updateData((prev) => ({
        ...prev,
        manualItems: {
          ...prev.manualItems,
          [weekKey]: (prev.manualItems[weekKey] ?? []).map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          ),
        },
      }));
    },
    [updateData, weekKey]
  );

  const removeManualItem = useCallback(
    (itemId) => {
      updateData((prev) => ({
        ...prev,
        manualItems: {
          ...prev.manualItems,
          [weekKey]: (prev.manualItems[weekKey] ?? []).filter(
            (item) => item.id !== itemId
          ),
        },
      }));
    },
    [updateData, weekKey]
  );

  const clearChecked = useCallback(() => {
    updateData((prev) => {
      const overrides = Object.fromEntries(
        Object.entries(prev.shoppingOverrides[weekKey] ?? {}).map(([k, v]) => [
          k,
          { ...v, checked: false },
        ])
      );
      const manual = (prev.manualItems[weekKey] ?? []).map((i) => ({
        ...i,
        checked: false,
      }));
      return {
        ...prev,
        shoppingOverrides: { ...prev.shoppingOverrides, [weekKey]: overrides },
        manualItems: { ...prev.manualItems, [weekKey]: manual },
      };
    });
  }, [updateData, weekKey]);

  if (loading) {
    return (
      <div className="app-loading">
        <span className="app-loading-icon">🍴</span>
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-loading">
        <span className="app-loading-icon">⚠️</span>
        <p>{error}</p>
        <p className="app-loading-hint">Run <code>npm run dev</code> in the meal-planner directory.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">
            <span className="app-logo-icon">🍽</span>
            <span className="app-logo-text">Meal Planner</span>
          </div>
          <nav className="app-nav">
            <button
              className={`nav-tab ${activeTab === 'planner' ? 'active' : ''}`}
              onClick={() => setActiveTab('planner')}
            >
              Meal Plan
            </button>
            <button
              className={`nav-tab ${activeTab === 'shopping' ? 'active' : ''}`}
              onClick={() => setActiveTab('shopping')}
            >
              Shopping List
            </button>
            <button
              className={`nav-tab ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              Favorites
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'planner' ? (
          <WeeklyPlanner
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            weeklyPlan={data.weeklyPlan}
            recipes={data.recipes}
            onAddRecipe={addRecipeToMeal}
            onRemoveRecipe={removeRecipeFromMeal}
          />
        ) : activeTab === 'favorites' ? (
          <Favorites
            favorites={data.favorites ?? {}}
            onAdd={addFavorite}
            onRemove={removeFavorite}
          />
        ) : (
          <ShoppingList
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            weeklyPlan={data.weeklyPlan}
            recipes={data.recipes}
            shoppingOverrides={data.shoppingOverrides[weekKey] ?? {}}
            manualItems={data.manualItems[weekKey] ?? []}
            onToggleIngredient={toggleIngredient}
            onAddManualItem={addManualItem}
            onToggleManualItem={toggleManualItem}
            onRemoveManualItem={removeManualItem}
            onClearChecked={clearChecked}
          />
        )}
      </main>
    </div>
  );
}
