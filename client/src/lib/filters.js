// Search filters live in the URL (/search?category=HAIR&date=2026-11-23), so results can be
// shared, bookmarked and survive the back button.
import { EMPTY_FILTERS } from '../components/SearchFilters.jsx';

export function filtersFromParams(sp) {
  return {
    category: sp.get('category') ?? '',
    area: sp.get('area') ?? '',
    date: sp.get('date') ?? '',
    minPrice: sp.get('minPrice') ?? '',
    maxPrice: sp.get('maxPrice') ?? '',
    homeOnly: sp.get('homeOnly') === 'true',
  };
}

export function paramsFromFilters(filters) {
  const sp = new URLSearchParams();
  Object.entries({ ...EMPTY_FILTERS, ...filters }).forEach(([key, value]) => {
    if (value !== '' && value !== false && value != null) sp.set(key, String(value));
  });
  return sp;
}
