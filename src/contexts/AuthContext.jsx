import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fonction pour récupérer les infos utilisateur depuis /me
  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/me');
      setUser(response.data);
      console.log('✅ User refreshed:', response.data);
    } catch (error) {
      console.error('❌ Error refreshing user:', error);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Fonction de connexion
  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token } = response.data;
      
      localStorage.setItem('token', access_token);
      
      // ⭐ IMPORTANT : Appeler refreshUser() immédiatement après le login
      await refreshUser();
      
      return { success: true };
    } catch (error) {
      console.error('❌ Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Erreur de connexion' 
      };
    }
  };

  // Fonction d'inscription
  const register = async (email, password, full_name) => {
    try {
      const response = await api.post('/auth/register', { 
        email, 
        password, 
        full_name 
      });
      const { access_token } = response.data;
      
      localStorage.setItem('token', access_token);
      
      // ⭐ IMPORTANT : Appeler refreshUser() immédiatement après l'inscription
      await refreshUser();
      
      return { success: true };
    } catch (error) {
      console.error('❌ Register error:', error);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Erreur d\'inscription' 
      };
    }
  };

  // Fonction de déconnexion
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    console.log('✅ User logged out');
  };

  // Charger l'utilisateur au montage du composant
  useEffect(() => {
    refreshUser();
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
