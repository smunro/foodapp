export async function fetchData() {
  const res = await fetch('/api/data');
  if (!res.ok) throw new Error('Failed to load data');
  return res.json();
}

export async function saveData(data) {
  const res = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save data');
}

export async function fetchRecipe(url) {
  const res = await fetch(`/api/recipe?url=${encodeURIComponent(url)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch recipe');
  return data;
}

export async function fetchSuggestions(favorites) {
  const res = await fetch('/api/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorites }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get suggestions');
  return data.suggestions;
}
