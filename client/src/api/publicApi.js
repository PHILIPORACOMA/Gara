import { http } from './http.js';

export const getMeta = () => http.get('/meta').then((r) => r.data);
export const getPublicSettings = () => http.get('/settings/public').then((r) => r.data.settings);
