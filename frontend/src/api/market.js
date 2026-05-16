import api from './client.js';

// GET /api/market-prices
// Optional params: { crop|commodity, state, district, market, limit }
export const getMarketPrices = (params) => api.get('/market-prices', { params });
