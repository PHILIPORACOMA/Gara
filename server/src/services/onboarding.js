// What a professional must finish before submitting for verification.
// Pure function (no database), so it is easy to unit test.

export const MIN_PORTFOLIO_IMAGES = 1;
export const MAX_PORTFOLIO_IMAGES = 12;

export function buildChecklist({ profile, categoryCount, areaCount, activeServiceCount, availabilityCount, portfolioCount, hasIdImage }) {
  const needsStore = profile.serviceMode === 'STORE' || profile.serviceMode === 'BOTH';
  const basicsDone =
    Boolean(profile.displayName?.trim()) &&
    categoryCount > 0 &&
    areaCount > 0 &&
    (!needsStore || Boolean(profile.storeAddress?.trim()));

  const items = [
    { key: 'profile', label: 'Complete your profile (name, categories, areas, service mode)', done: basicsDone, link: '/pro/profile' },
    { key: 'services', label: 'Add at least one service with a price', done: activeServiceCount > 0, link: '/pro/services' },
    { key: 'availability', label: 'Set your weekly availability', done: availabilityCount > 0, link: '/pro/availability' },
    {
      key: 'portfolio',
      label: `Upload at least ${MIN_PORTFOLIO_IMAGES} portfolio photo${MIN_PORTFOLIO_IMAGES > 1 ? 's' : ''}`,
      done: portfolioCount >= MIN_PORTFOLIO_IMAGES,
      link: '/pro/portfolio',
    },
    { key: 'id', label: 'Upload a valid government ID', done: hasIdImage, link: '/pro/verification' },
  ];

  return { items, complete: items.every((i) => i.done), missing: items.filter((i) => !i.done).map((i) => i.key) };
}
