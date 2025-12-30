import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Zap, ArrowRight, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';  // ⭐ AJOUT : Import du context

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();  // ⭐ AJOUT : Utiliser le context

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    console.log('🔵 Login.jsx - handleSubmit called');

    try {
      // ⭐ MODIFIÉ : Utiliser la fonction login du context
      const result = await login(email, password);
      
      console.log('🔵 Login.jsx - login result:', result);

      if (result.success) {
        toast.success('Connexion réussie ! 🎉');
        
        // Rediriger vers le dashboard
        setTimeout(() => {
          console.log('🔵 Login.jsx - navigating to dashboard');
          navigate('/dashboard');
        }, 500);
      } else {
        toast.error(result.error || 'Email ou mot de passe incorrect');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Section gauche - Formulaire */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ComptaFlow
            </span>
          </div>

          {/* Titre */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bon retour parmi nous
            </h1>
            <p className="text-gray-600">
              Connectez-vous pour accéder à votre compte
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="votre@email.com"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Lien inscription */}
          <p className="mt-6 text-center text-gray-600">
            Pas encore de compte ?{' '}
            <Link
              to="/register"
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </div>

      {/* Section droite - Image/Info */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-purple-600 p-12 items-center justify-center">
        <div className="text-white max-w-md">
          <h2 className="text-4xl font-bold mb-6">
            Simplifiez votre comptabilité
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            Gagnez du temps sur votre comptabilité avec notre outil automatisé.
            Convertissez vos relevés bancaires en quelques clics.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg mt-1">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Conversion instantanée</h3>
                <p className="text-blue-100 text-sm">
                  Transformez vos PDFs en fichiers Excel en quelques secondes
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg mt-1">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Support multi-banques</h3>
                <p className="text-blue-100 text-sm">
                  Compatible avec LCL, Cré
