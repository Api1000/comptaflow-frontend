import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export default function Success() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [userUpdated, setUserUpdated] = useState(false);

  useEffect(() => {
    // Fonction pour rafraîchir les données utilisateur
    const updateUserData = async () => {
      try {
        // Attendre 2 secondes pour laisser le webhook Stripe s'exécuter
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Récupérer les nouvelles données depuis l'API
        await refreshUser();

        setUserUpdated(true);
        setLoading(false);

        toast.success('🎉 Votre abonnement a été activé !');

        // Rediriger vers dashboard après 3 secondes
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);

      } catch (error) {
        console.error('Error refreshing user data:', error);
        setLoading(false);

        // Même en cas d'erreur, rediriger quand même
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      }
    };

    if (sessionId) {
      updateUserData();
    } else {
      setLoading(false);
    }
  }, [sessionId, refreshUser, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        {loading ? (
          <>
            <div className="relative mb-6">
              <Loader2 className="w-20 h-20 text-blue-500 mx-auto animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full animate-ping"></div>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Activation en cours...
            </h1>
            <p className="text-gray-600">
              Nous mettons à jour votre compte avec votre nouvel abonnement.
            </p>
          </>
        ) : (
          <>
            <div className="relative mb-6">
              <CheckCircle className="w-24 h-24 text-green-500 mx-auto animate-bounce" />
              {userUpdated && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2">
                  <div className="w-24 h-24 rounded-full bg-green-400 opacity-20 animate-ping"></div>
                </div>
              )}
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Paiement réussi ! 🎉
            </h1>

            <p className="text-gray-600 mb-6 leading-relaxed">
              Votre abonnement a été activé avec succès.
              <br />
              Vous pouvez maintenant profiter de toutes les fonctionnalités premium.
            </p>

            {sessionId && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6 border border-blue-100">
                <p className="text-xs text-gray-500 mb-1 font-semibold">Session ID</p>
                <p className="text-sm text-blue-800 font-mono break-all">
                  {sessionId}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                Aller au Dashboard
              </button>

              <p className="text-sm text-gray-500 animate-pulse">
                Redirection automatique dans 3 secondes...
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}