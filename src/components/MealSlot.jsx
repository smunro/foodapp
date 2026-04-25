import React from 'react';

export default function MealSlot({ recipes, isToday, onAdd, onRemove, favoriteUrls, onToggleFavorite }) {
  return (
    <div className={`meal-slot ${isToday ? 'today' : ''}`}>
      {recipes.map((recipe) => {
        const isFav = !recipe.freeText && recipe.url && favoriteUrls?.has(recipe.url);
        return (
          <div key={recipe.id} className={`recipe-chip ${recipe.freeText ? 'recipe-chip-free' : ''}`} title={recipe.name}>
            {recipe.image && (
              <img src={recipe.image} alt="" className="recipe-chip-img" />
            )}
            <span className="recipe-chip-name">{recipe.name}</span>
            {!recipe.freeText && onToggleFavorite && (
              <button
                className={`recipe-chip-fav ${isFav ? 'is-fav' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(recipe); }}
                title={isFav ? 'Remove from favorites' : 'Save to favorites'}
              >
                {isFav ? '★' : '☆'}
              </button>
            )}
            <button
              className="recipe-chip-remove"
              onClick={(e) => { e.stopPropagation(); onRemove(recipe.id); }}
              title="Remove from this meal"
            >
              ×
            </button>
          </div>
        );
      })}
      <button className="add-recipe-btn" onClick={onAdd} title="Add recipe">
        +
      </button>
    </div>
  );
}
