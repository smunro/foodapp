import React from 'react';

export default function MealSlot({ recipes, isToday, onAdd, onRemove }) {
  return (
    <div className={`meal-slot ${isToday ? 'today' : ''}`}>
      {recipes.map((recipe) => (
        <div key={recipe.id} className={`recipe-chip ${recipe.freeText ? 'recipe-chip-free' : ''}`} title={recipe.name}>
          {recipe.image && (
            <img src={recipe.image} alt="" className="recipe-chip-img" />
          )}
          <span className="recipe-chip-name">{recipe.name}</span>
          <button
            className="recipe-chip-remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(recipe.id);
            }}
            title="Remove from this meal"
          >
            ×
          </button>
        </div>
      ))}
      <button className="add-recipe-btn" onClick={onAdd} title="Add recipe">
        +
      </button>
    </div>
  );
}
