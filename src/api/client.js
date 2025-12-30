import axios from 'axios';

// Configuration de l'URL de l'API
const API_URL = import.meta.env.VITE_API_URL || 'https://comptaflow-backend.onrender.com';

console.log('🔧 API URL:', API_URL);

// Créer l'instance axios
const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============ INTERCEPTEUR REQUEST ============
// Ajoute automatiquement le token JWT à chaque requête
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
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ============ INTERCEPTEUR RESPONSE ============
// Gère automatiquement les erreurs 401 (token expiré/invalide)
client.interceptors.response.use(
  (response) => {
    // Requête réussie, retourner la réponse telle quelle
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ 401 Unauthorized - Token invalide ou expiré');
      
      // Nettoyer le localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Rediriger vers la page de connexion
      // Éviter de rediriger si on est déjà sur /login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// ============ API ENDPOINTS ============

// Endpoints d'authentification
export const authAPI = {
  login: (email, password) => 
    client.post('/auth/login', { email, password }),
  
  register: (email, password, fullName) => 
    client.post('/auth/register', { 
      email, 
      password, 
      full_name: fullName 
    }),
  
  // Récupérer les infos de l'utilisateur connecté
  me: () => client.get('/me'),
};

// Endpoints pour les uploads
export const uploadAPI = {
  // Récupérer l'historique des conversions
  getHistory: () => client.get('/history'),
  
  // Upload un fichier PDF
  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return client.post('/upload', formData, {
      headers: { 
        'Content-Type': 'multipart/form-data' 
      },
    });
  },
  
  // Télécharger un fichier Excel converti
  download: (uploadId) => 
    client.get(`/download/${uploadId}`, { 
      responseType: 'blob' 
    }),
  
  // Récupérer les statistiques d'usage
  getUsage: () => client.get('/usage'),
};

// Endpoints Stripe
export const stripeAPI = {
  // Créer une session de paiement
  createCheckoutSession: (plan) => 
    client.post('/create-checkout-session', { plan }),
};

// Export par défaut de l'instance client
export default client;
