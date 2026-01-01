import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut, Crown, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function TopBar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Fonction pour gérer l'abonnement
  const handleManageSubscription = async () => {
    setShowDropdown(false);
    
    try {
      const response = await api.post('/create-portal-session');
      window.location.href = response.data.url;
    } catch (error) {
      console.error('❌ Error creating portal session:', error);
      toast.error('Impossible d\'accéder au portail de gestion');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPlanBadge = () => {
    const plan = user?.subscription_tier || 'free';
    const colors = {
      free: 'bg-gray-100 text-gray-700',
      premium: 'bg-blue-100 text-blue-700',
      pro: 'bg-purple-100 text-purple-700',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${colors[plan]}`}>
        {plan}
      </span>
    );
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Crown className="h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">ComptaFlow</span>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-4">
            {/* Plan Badge */}
            {user && getPlanBadge()}

            {/* User Avatar Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {user?.full_name || user?.email}
                </span>
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>

                  {/* Manage Subscription - Visible uniquement pour premium/pro */}
                  {user?.subscription_tier && user.subscription_tier !== 'free' && (
                    <button
                      onClick={handleManageSubscription}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Gérer mon abonnement</span>
                    </button>
                  )}

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Déconnexion</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
