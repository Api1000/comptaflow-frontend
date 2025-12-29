import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock, Loader } from 'lucide-react';
import { authAPI } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    console.log('✅ Form submitted!', { email, password });

    if (!email.trim()) {
      toast.error('L\'email est requis');
      return;
    }

    if (!password.trim()) {
      toast.error('Le mot de passe est requis');
      return;
    }

    setLoading(true);

    try {
      console.log('📤 Tentative de connexion avec:', { email });
      const response = await authAPI.login(email, password);
      
      console.log('✅ Response reçue:', response.data);
      
      const { access_token, user } = response.data;
      
      if (!access_token) {
        throw new Error('No token in response');
      }

      console.log('🔑 Token reçu:', access_token.substring(0, 20) + '...');
      
      // ✅ CORRECTION : Stocker le token correctement
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      
      console.log('💾 Token stocké dans localStorage');
      
      toast.success('Connecté avec succès!');
      navigate('/dashboard');
    } catch (error) {
      console.error('❌ Erreur login:', error.response?.data || error.message);
      
      const message = 
        error.response?.data?.detail || 
        error.response?.data?.message ||
        'Erreur de connexion. Vérifiez vos identifiants.';
      
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Connexion</h1>
          <p className="text-gray-600 mt-2">Accédez à votre compte</p>
        </div>

        {/* Affichage des erreurs */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
          </div>

          {/* Bouton de connexion */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader size={20} className="animate-spin" />
                Connexion en cours...
              </>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        {/* Lien vers register */}
        <p className="text-center text-gray-600 mt-6">
          Pas encore de compte?{' '}
          <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}