import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Pricing() {
  const [loading, setLoading] = useState(null);
  const { user } = useAuth();
  const currentPlan = user?.subscription_tier || 'free';
  const navigate = useNavigate();

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '0€',
      period: '',
      features: [
        '5 conversions/mois',
        'CA, BP, LCL supportés',
        'Export Excel',
        'Support email'
      ],
      cta: 'Plan actuel'
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '9.99€',
      period: '/mois',
      features: [
        '50 conversions/mois',
        'Tous les formats supportés',
        'Export Excel & CSV',
        'Support prioritaire',
        'Historique illimité'
      ],
      cta: 'Passer à Premium',
      highlight: true
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '29.99€',
      period: '/mois',
      features: [
        'Conversions illimitées',
        'API Access',
        'Webhooks',
        'Support dédié 24/7',
        'Personnalisation avancée'
      ],
      cta: 'Passer à Pro'
    }
  ];

  const handleUpgrade = async (planId) => {
    if (planId === currentPlan) return;

    setLoading(planId);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Veuillez vous connecter');
        navigate('/login');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: planId })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la création de la session');
      }

      const data = await response.json();

      // Rediriger vers Stripe
      window.location.href = data.url;
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erreur lors de la redirection vers Stripe');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Choisissez votre plan
          </h1>
          <p className="text-xl text-gray-600">
            Convertissez vos relevés bancaires en quelques clics
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlan;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl shadow-xl p-8 relative transition-all hover:shadow-2xl ${
                  plan.highlight ? 'ring-4 ring-blue-500 transform scale-105' : ''
                }`}
              >
                {plan.highlight && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-bold px-6 py-2 rounded-full shadow-lg">
                      POPULAIRE
                    </div>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-3 text-gray-900">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-gray-600 text-lg">{plan.period}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <svg
                        className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-gray-700 text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrentPlan || loading === plan.id}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center shadow-lg ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transform hover:-translate-y-1'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  } ${isCurrentPlan || loading === plan.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading === plan.id ? (
                    <>
                      <Loader className="animate-spin mr-2" size={20} />
                      Chargement...
                    </>
                  ) : (
                    isCurrentPlan ? 'Plan actuel' : plan.cta
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center text-gray-600 space-y-2">
          <p className="flex items-center justify-center gap-2 text-lg">
            🔒 <span className="font-semibold">Paiement sécurisé par Stripe</span>
          </p>
          <p className="text-sm">Annulation possible à tout moment</p>
        </div>
      </div>
    </div>
  );
}