import api from './client.js';

// `mine: true` -> /crops/mine/list (auth, farmer only); otherwise /crops.
export const listCrops = (params = {}) => {
  const { mine, ...rest } = params;
  return mine ? api.get('/crops/mine/list') : api.get('/crops', { params: rest });
};
export const createCrop = (payload) => api.post('/crops', payload);
export const getCrop = (id) => api.get(`/crops/${id}`);
// Backend expects camelCase: { cropId }.
export const predictForCrop = (payload) => {
  const body = { ...payload };
  if (body.crop_id != null && body.cropId == null) {
    body.cropId = body.crop_id;
    delete body.crop_id;
  }
  return api.post('/predict', body);
};
