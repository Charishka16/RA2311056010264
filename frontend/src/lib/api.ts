import axios from 'axios';

// Using relative URLs — Vite proxy forwards /api/* to http://localhost:3001
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('jf_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
