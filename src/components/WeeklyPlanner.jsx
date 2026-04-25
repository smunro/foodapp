import React, { useState } from 'react';
import { addDays, toDateKey, formatWeekRange, isToday, getWeekStart } from '../utils/dates';
import MealSlot from './MealSlot';
import AddRecipeModal from './AddRecipeModal';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = {
  breakfast: { emoji: '🌅', label: 'Breakfast' },
  lunch:     { emoji: '☀️',  label: 'Lunch' },
  dinner:    { emoji: '🌙', label: 'Dinner' },
};

export default function WeeklyPlanner({
  weekStart,
  onWeekChange,
  weeklyPlan,
  recipes,
  onAddRecipe,
  onRemoveRecipe,
  favorites,
  onToggleFavorite,
}) {
  const [modal, setModal] = useState(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const favoriteUrls = new Set(
    Object.values(favorites ?? {}).map((f) => f.url).filter(Boolean)
  );

  const handleModalAdd = (recipe) => {
    if (modal) onAddRecipe(modal.dateKey, modal.mealType, recipe);
    setModal(null);
  };

  return (
    <div className="weekly-planner">
      {/* Week navigation */}
      <div className="week-nav">
        <button className="week-nav-btn" onClick={() => onWeekChange(addDays(weekStart, -7))}>
          ← Prev
        </button>
        <div className="week-nav-center">
          <h2 className="week-title">{formatWeekRange(weekStart)}</h2>
          <button className="this-week-btn" onClick={() => onWeekChange(getWeekStart())}>
            Today
          </button>
        </div>
        <button className="week-nav-btn" onClick={() => onWeekChange(addDays(weekStart, 7))}>
          Next →
        </button>
      </div>

      {/* One card per meal type */}
      <div className="meal-sections">
        {MEAL_TYPES.map((mealType) => (
          <div key={mealType} className="meal-section">
            <div className="meal-section-heading">
              <span>{MEAL_LABELS[mealType].emoji}</span>
              {MEAL_LABELS[mealType].label}
            </div>

            {weekDays.map((day) => {
              const dateKey = toDateKey(day);
              const today = isToday(day);
              const ids = weeklyPlan[dateKey]?.[mealType] ?? [];
              const mealRecipes = ids.map((id) => recipes[id]).filter(Boolean);

              return (
                <div key={dateKey} className={`day-row ${today ? 'today' : ''}`}>
                  <div className="day-row-label">
                    <span className="day-row-weekday">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span className="day-row-date">{day.getDate()}</span>
                  </div>
                  <MealSlot
                    recipes={mealRecipes}
                    isToday={today}
                    onAdd={() => setModal({ dateKey, mealType })}
                    onRemove={(id) => onRemoveRecipe(dateKey, mealType, id)}
                    favoriteUrls={favoriteUrls}
                    onToggleFavorite={onToggleFavorite}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {modal && (
        <AddRecipeModal
          dateKey={modal.dateKey}
          mealType={modal.mealType}
          existingRecipes={recipes}
          onAdd={handleModalAdd}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
