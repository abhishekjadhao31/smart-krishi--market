import api from './client.js';

// GET /api/market-prices
// Optional params: { crop, location, from, to }
export const getMarketPrices = (params) => api.get('/market-prices', { params });
