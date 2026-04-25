import React, { useState } from 'react';
import { addDays, toDateKey, formatWeekRange, isToday, getWeekStart } from '../utils/dates';
import MealSlot from './MealSlot';
import AddRecipeModal from './AddRecipeModal';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
const MEAL_LABELS = {
  breakfast: { emoji: '🌅', label: 'Breakfast' },
  lunch: { emoji: '☀️', label: 'Lunch' },
  dinner: { emoji: '🌙', label: 'Dinner' },
};

export default function WeeklyPlanner({
  weekStart,
  onWeekChange,
  weeklyPlan,
  recipes,
  onAddRecipe,
  onRemoveRecipe,
}) {
  const [modal, setModal] = useState(null); // { dateKey, mealType }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handleAddClick = (dateKey, mealType) => setModal({ dateKey, mealType });

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

      {/* Grid */}
      <div className="planner-grid">
        {/* Day headers */}
        <div className="planner-header-row">
          <div className="meal-label-spacer" />
          {weekDays.map((day) => {
            const today = isToday(day);
            return (
              <div key={toDateKey(day)} className={`day-header ${today ? 'today' : ''}`}>
                <span className="day-name">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="day-date">{day.getDate()}</span>
              </div>
            );
          })}
        </div>

        {/* Meal rows */}
        {MEAL_TYPES.map((mealType) => (
          <div key={mealType} className="planner-meal-row">
            <div className="meal-label">
              <span className="meal-label-emoji">{MEAL_LABELS[mealType].emoji}</span>
              <span className="meal-label-text">{MEAL_LABELS[mealType].label}</span>
            </div>

            {weekDays.map((day) => {
              const dateKey = toDateKey(day);
              const ids = weeklyPlan[dateKey]?.[mealType] ?? [];
              const mealRecipes = ids.map((id) => recipes[id]).filter(Boolean);

              return (
                <MealSlot
                  key={dateKey}
                  recipes={mealRecipes}
                  isToday={isToday(day)}
                  onAdd={() => handleAddClick(dateKey, mealType)}
                  onRemove={(recipeId) => onRemoveRecipe(dateKey, mealType, recipeId)}
                />
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
