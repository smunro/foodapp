import React, { useState, useMemo } from 'react';
import { addDays, toDateKey, formatWeekRange, getWeekStart } from '../utils/dates';
import { groupIngredients } from '../utils/ingredients';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

function buildExportText(uncheckedItems, uncheckedManual) {
  const lines = [
    ...uncheckedItems.map((item) => {
      // Combine quantities from all sources: "2 cloves + 1 clove garlic"
      const qtys = item.sources
        .map((s) => [s.quantity, s.unit].filter(Boolean).join('\u202f'))
        .filter(Boolean);
      const qtyStr = qtys.length ? qtys.join(' + ') + ' ' : '';
      return qtyStr + item.name;
    }),
    ...uncheckedManual.map((i) => i.text),
  ];
  return lines.join('\n');
}

export default function ShoppingList({
  weekStart,
  onWeekChange,
  weeklyPlan,
  recipes,
  shoppingOverrides,
  manualItems,
  onToggleIngredient,
  onAddManualItem,
  onToggleManualItem,
  onRemoveManualItem,
  onClearChecked,
}) {
  const [newItem, setNewItem] = useState('');
  const [showChecked, setShowChecked] = useState(true);
  const [showSetup, setShowSetup] = useState(false);

  // Collect unique recipes for this week
  const recipeIngredients = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (let i = 0; i < 7; i++) {
      const dateKey = toDateKey(addDays(weekStart, i));
      const dayPlan = weeklyPlan[dateKey] ?? {};
      for (const mealType of MEAL_TYPES) {
        for (const recipeId of dayPlan[mealType] ?? []) {
          if (seen.has(recipeId)) continue;
          seen.add(recipeId);
          const recipe = recipes[recipeId];
          if (recipe) {
            result.push({
              recipeId: recipe.id,
              recipeName: recipe.name,
              ingredients: recipe.ingredients,
            });
          }
        }
      }
    }
    return result;
  }, [weeklyPlan, recipes, weekStart]);

  const grouped = useMemo(
    () => groupIngredients(recipeIngredients),
    [recipeIngredients]
  );

  const unchecked = grouped.filter((g) => !shoppingOverrides[g.key]?.checked);
  const checked = grouped.filter((g) => shoppingOverrides[g.key]?.checked);
  const uncheckedManual = manualItems.filter((i) => !i.checked);
  const checkedManual = manualItems.filter((i) => i.checked);

  const totalItems = grouped.length + manualItems.length;
  const totalChecked = checked.length + checkedManual.length;
  const uncheckedCount = (unchecked.length + uncheckedManual.length);

  const handleAdd = () => {
    if (newItem.trim()) {
      onAddManualItem(newItem.trim());
      setNewItem('');
    }
  };

  const handleExport = () => {
    const text = buildExportText(unchecked, uncheckedManual);
    if (!text) return;
    const url = `shortcuts://run-shortcut?name=Add%20to%20Reminders&input=text&text=${encodeURIComponent(text)}`;
    window.location.href = url;
  };

  return (
    <div className="shopping-list">
      {/* Week nav */}
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

      <div className="shopping-content">
        {/* Progress bar */}
        {totalItems > 0 && (
          <div className="progress-card">
            <div className="progress-label-row">
              <span className="progress-label-text">
                {totalChecked} of {totalItems} items checked off
              </span>
              <div className="progress-actions">
                {totalChecked > 0 && (
                  <button className="uncheck-all-btn" onClick={onClearChecked}>
                    Uncheck all
                  </button>
                )}
                {uncheckedCount > 0 && (
                  <button className="export-btn" onClick={handleExport} title="Export unchecked items to Apple Reminders">
                    􀊵 Export to Reminders
                  </button>
                )}
              </div>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${(totalChecked / totalItems) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalItems === 0 && (
          <div className="empty-state">
            <p className="empty-icon">🛒</p>
            <p className="empty-title">Your list is empty</p>
            <p className="empty-desc">
              Add recipes to your meal plan and they'll appear here, or add items manually below.
            </p>
          </div>
        )}

        {/* Unchecked recipe ingredients */}
        {unchecked.length > 0 && (
          <div className="list-card">
            {recipeIngredients.length > 0 && (
              <h3 className="list-card-heading">From your recipes</h3>
            )}
            {unchecked.map((item) => (
              <IngredientRow
                key={item.key}
                item={item}
                checked={false}
                onToggle={() => onToggleIngredient(item.key)}
              />
            ))}
          </div>
        )}

        {/* Unchecked manual items */}
        {uncheckedManual.length > 0 && (
          <div className="list-card">
            <h3 className="list-card-heading">Other items</h3>
            {uncheckedManual.map((item) => (
              <ManualRow
                key={item.id}
                item={item}
                onToggle={() => onToggleManualItem(item.id)}
                onRemove={() => onRemoveManualItem(item.id)}
              />
            ))}
          </div>
        )}

        {/* Add item */}
        <div className="add-item-card">
          <div className="add-item-row">
            <input
              type="text"
              className="add-item-input"
              placeholder="Add an item…"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              className="add-item-btn"
              onClick={handleAdd}
              disabled={!newItem.trim()}
            >
              Add
            </button>
          </div>
        </div>

        {/* Export to Reminders setup instructions */}
        {totalItems > 0 && (
          <div className="setup-card">
            <button className="setup-toggle" onClick={() => setShowSetup((v) => !v)}>
              <span>{showSetup ? '▾' : '▸'}</span>
              First time? Set up the iPhone Shortcut
            </button>
            {showSetup && (
              <ol className="setup-steps">
                <li>On your iPhone, open the <strong>Shortcuts</strong> app</li>
                <li>Tap <strong>+</strong> to create a new shortcut</li>
                <li>Tap the name at the top and rename it exactly: <strong>Add to Reminders</strong></li>
                <li>Tap <strong>Add Action</strong> → search <strong>Split Text</strong> → add it, set Separator to <em>New Lines</em></li>
                <li>Tap the variable in Split Text and set it to <strong>Shortcut Input</strong></li>
                <li>Tap <strong>Add Action</strong> → search <strong>Repeat with Each</strong> → add it</li>
                <li>Inside the repeat block tap <strong>Add Action</strong> → search <strong>Add New Reminder</strong> → add it</li>
                <li>Tap the reminder text field and select <strong>Repeat Item</strong> from the variables</li>
                <li>Optionally set the <strong>List</strong> to Groceries (or any list you like)</li>
                <li>Tap <strong>Done</strong> ✓</li>
              </ol>
            )}
          </div>
        )}

        {/* Checked items (collapsible) */}
        {totalChecked > 0 && (
          <div className="list-card checked-card">
            <button
              className="checked-toggle"
              onClick={() => setShowChecked((v) => !v)}
            >
              <span className="checked-toggle-arrow">{showChecked ? '▾' : '▸'}</span>
              Checked ({totalChecked})
            </button>
            {showChecked && (
              <>
                {checked.map((item) => (
                  <IngredientRow
                    key={item.key}
                    item={item}
                    checked={true}
                    onToggle={() => onToggleIngredient(item.key)}
                  />
                ))}
                {checkedManual.map((item) => (
                  <ManualRow
                    key={item.id}
                    item={item}
                    onToggle={() => onToggleManualItem(item.id)}
                    onRemove={() => onRemoveManualItem(item.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IngredientRow({ item, checked, onToggle }) {
  return (
    <div className={`list-row ${checked ? 'row-checked' : ''}`} onClick={onToggle}>
      <Checkbox checked={checked} />
      <div className="row-body">
        <span className="row-name">{item.name}</span>
        <div className="row-sources">
          {item.sources.map((src, i) => (
            <span key={i} className="source-tag">
              {[src.quantity, src.unit].filter(Boolean).join('\u202f')}
              {(src.quantity || src.unit) && ' · '}
              {src.recipeName}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ManualRow({ item, onToggle, onRemove }) {
  return (
    <div className={`list-row ${item.checked ? 'row-checked' : ''}`}>
      <div onClick={onToggle} style={{ display: 'contents' }}>
        <Checkbox checked={item.checked} />
        <div className="row-body" style={{ cursor: 'pointer' }}>
          <span className="row-name">{item.text}</span>
          <span className="source-tag manual-tag">Added manually</span>
        </div>
      </div>
      <button
        className="remove-btn"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}

function Checkbox({ checked }) {
  return (
    <div className={`checkbox ${checked ? 'checkbox-checked' : ''}`}>
      {checked && (
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
          <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
