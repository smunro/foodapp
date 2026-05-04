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

export async function fetchRecipe(url, caption) {
  const params = new URLSearchParams({ url });
  if (caption) params.set('caption', caption);
  const res = await fetch(`/api/recipe?${params}`);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Failed to fetch recipe');
    err.code = data.code;
    throw err;
  }
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
