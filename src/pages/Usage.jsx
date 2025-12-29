import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, TrendingUp, Calendar, Zap, Award } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Usage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/usage`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load stats');

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const plan = stats?.plan || 'free';
  const limits = { free: 5, premium: 50, pro: '∞' };
  const uploadsCount = stats?.uploads_count || 0;
  const limit = stats?.limit || 5;
  const percentage = limit === null ? 0 : Math.min((uploadsCount / limit) * 100, 100);

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const currentMonth = monthNames[stats?.month - 1] || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Usage & Statistiques</h1>
        <p className="text-gray-600 mt-2">Suivez votre consommation et optimisez votre plan</p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Plan Card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Award size={24} />
            {plan !== 'free' && <Zap className="text-yellow-300" size={20} />}
          </div>
          <p className="text-blue-100 text-sm font-medium mb-1">Plan actuel</p>
          <p className="text-3xl font-bold uppercase">{plan}</p>
          {plan === 'free' && (
            <button
              onClick={() => navigate('/pricing')}
              className="mt-4 w-full bg-white text-blue-600 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Upgrade →
            </button>
          )}
        </div>

        {/* Uploads this month */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <Calendar className="text-gray-400 mb-4" size={24} />
          <p className="text-gray-600 text-sm font-medium mb-1">Ce mois-ci</p>
          <p className="text-3xl font-bold text-gray-900">{uploadsCount}</p>
          <p className="text-sm text-gray-500 mt-1">sur {limits[plan]} conversions</p>
        </div>

        {/* Remaining */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <TrendingUp className="text-green-500 mb-4" size={24} />
          <p className="text-gray-600 text-sm font-medium mb-1">Restant</p>
          <p className="text-3xl font-bold text-gray-900">
            {limit === null ? '∞' : limit - uploadsCount}
          </p>
          <p className="text-sm text-gray-500 mt-1">conversions disponibles</p>
        </div>
      </div>

      {/* Usage Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Progression mensuelle</h3>
            <p className="text-sm text-gray-600 mt-1">{currentMonth} {stats?.year}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{Math.round(percentage)}%</p>
            <p className="text-sm text-gray-600">utilisé</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              style={{ width: `${percentage}%` }}
              className={`h-full transition-all duration-500 rounded-full ${
                percentage >= 90 ? 'bg-red-500' : 
                percentage >= 70 ? 'bg-yellow-500' : 
                'bg-gradient-to-r from-blue-500 to-blue-600'
              }`}
            />
          </div>
        </div>

        {/* Alerts */}
        {plan === 'free' && uploadsCount >= 3 && uploadsCount < limit && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex gap-3">
              <TrendingUp className="text-yellow-600 flex-shrink-0" size={20} />
              <div>
                <p className="font-semibold text-yellow-800 mb-1">⚠️ Attention !</p>
                <p className="text-yellow-700 text-sm">
                  Vous approchez de votre limite mensuelle. Passez à Premium pour 50 conversions/mois.
                </p>
                <button
                  onClick={() => navigate('/pricing')}
                  className="mt-3 text-sm font-semibold text-yellow-700 hover:text-yellow-800 underline"
                >
                  Voir les plans →
                </button>
              </div>
            </div>
          </div>
        )}

        {uploadsCount >= limit && plan !== 'pro' && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-xl">🚫</span>
              </div>
              <div>
                <p className="font-semibold text-red-800 mb-1">Limite atteinte !</p>
                <p className="text-red-700 text-sm mb-3">
                  Vous avez utilisé toutes vos conversions ce mois-ci. Passez à un plan supérieur pour continuer.
                </p>
                <button
                  onClick={() => navigate('/pricing')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm transition-colors"
                >
                  Upgrade maintenant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Features included */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Fonctionnalités incluses</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plan === 'free' && (
            <>
              <FeatureItem 
                title="5 conversions/mois" 
                description="Parfait pour tester le service" 
              />
              <FeatureItem 
                title="Export Excel" 
                description="Format compatible Penny Lane" 
              />
              <FeatureItem 
                title="Support email" 
                description="Réponse sous 48h" 
              />
            </>
          )}

          {plan === 'premium' && (
            <>
              <FeatureItem 
                title="50 conversions/mois" 
                description="Pour une utilisation régulière" 
              />
              <FeatureItem 
                title="Export Excel & CSV" 
                description="Formats multiples" 
              />
              <FeatureItem 
                title="Support prioritaire" 
                description="Réponse sous 12h" 
              />
              <FeatureItem 
                title="Historique illimité" 
                description="Accédez à tous vos fichiers" 
              />
            </>
          )}

          {plan === 'pro' && (
            <>
              <FeatureItem 
                title="Conversions illimitées" 
                description="Aucune restriction" 
              />
              <FeatureItem 
                title="API Access" 
                description="Automatisez vos workflows" 
              />
              <FeatureItem 
                title="Support dédié 24/7" 
                description="Assistance immédiate" 
              />
              <FeatureItem 
                title="Personnalisation" 
                description="Adaptez l'outil à vos besoins" 
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Component helper pour les features
function FeatureItem({ title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-green-600 text-sm">✓</span>
      </div>
      <div>
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}
