import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_URL,
});

// Interceptor pour ajouter le token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔐 Token sent:', token.substring(0, 20) + '...');
    } else {
      console.warn('⚠️ No token found in localStorage');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized - Token invalide ou expiré');
      // Déconnecter l'utilisateur
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Rediriger vers login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) =>
    client.post('/auth/login', { email, password }),

  register: (email, password, fullName) =>
    client.post('/auth/register', { email, password, full_name: fullName }),

  // ✅ CORRIGÉ : Utilise /me au lieu de /auth/me
  me: () => client.get('/me'),
};

export const uploadAPI = {
  getHistory: () => client.get('/history'),

  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  download: (uploadId) =>
    client.get(`/download/${uploadId}`, { responseType: 'blob' }),

  getUsage: () => client.get('/usage'),
};

export default client;