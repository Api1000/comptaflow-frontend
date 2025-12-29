import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Check, Zap, Shield, TrendingUp, ArrowRight, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEligible, setIsEligible] = useState(true);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const navigate = useNavigate();

  // Vérifier localStorage ET serveur au chargement
  useEffect(() => {
    checkEligibility();
  }, []);

  const checkEligibility = async () => {
    setCheckingEligibility(true);
    
    // Check localStorage d'abord (rapide)
    const localUsed = localStorage.getItem('free_trial_used') === 'true';
    
    if (localUsed) {
      setIsEligible(false);
      setCheckingEligibility(false);
      return;
    }

    // Check serveur (IP tracking)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/check-guest-eligibility`);
      const data = await response.json();
      
      console.log('🔍 Eligibility check:', data);
      
      if (!data.eligible) {
        setIsEligible(false);
        localStorage.setItem('free_trial_used', 'true');
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
      // En cas d'erreur, on laisse l'utilisateur essayer
      setIsEligible(true);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      toast.error('Seuls les fichiers PDF sont acceptés');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    if (!isEligible) {
      setShowModal(true);
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/upload-guest`, {
        method: 'POST',
        body: formData
      });

      if (response.status === 403) {
        // IP déjà utilisée
        const error = await response.json();
        setIsEligible(false);
        localStorage.setItem('free_trial_used', 'true');
        toast.error(error.detail || 'Vous avez déjà utilisé votre conversion gratuite');
        setTimeout(() => setShowModal(true), 500);
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors de la conversion');
      }

      // Télécharger le fichier
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name.replace('.pdf', '_EXTRAIT.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('✅ Conversion réussie !');
      
      // Marquer comme utilisé
      setIsEligible(false);
      localStorage.setItem('free_trial_used', 'true');
      
      // Afficher modal après 2 secondes
      setTimeout(() => {
        setShowModal(true);
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Erreur lors de la conversion');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Zap className="text-white" size={20} />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ComptaFlow
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Connexion
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all transform hover:scale-105"
            >
              S'inscrire
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
              <Zap size={16} />
              <span>Conversion instantanée</span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Convertissez vos relevés bancaires en{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Excel
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              Transformez vos relevés PDF en fichiers Excel compatibles Penny Lane en quelques secondes. 
              Essayez gratuitement, sans inscription !
            </p>

            {/* Features */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Feature icon={<Check className="text-green-500" />} text="Conversion en 5 secondes" />
              <Feature icon={<Shield className="text-blue-500" />} text="100% sécurisé" />
              <Feature icon={<TrendingUp className="text-purple-500" />} text="Format Penny Lane" />
              <Feature icon={<Zap className="text-yellow-500" />} text="Essai gratuit" />
            </div>
          </div>

          {/* Right Column - Upload */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {checkingEligibility ? 'Vérification...' : isEligible ? 'Essayez gratuitement' : 'Créez un compte pour continuer'}
              </h3>
              <p className="text-gray-600">
                {checkingEligibility 
                  ? 'Chargement...'
                  : isEligible 
                    ? '1 conversion offerte, sans carte bancaire'
                    : 'Vous avez utilisé votre conversion gratuite'
                }
              </p>
            </div>

            {checkingEligibility ? (
              <div className="flex justify-center py-12">
                <Loader className="animate-spin text-blue-600" size={40} />
              </div>
            ) : !isEligible ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
                  <p className="text-blue-800 text-sm">
                    🎉 Créez un compte gratuit et obtenez <strong>5 conversions/mois</strong> !
                  </p>
                </div>
                <button
                  onClick={() => navigate('/register')}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-xl transition-all flex items-center justify-center gap-2 transform hover:scale-105"
                >
                  <span>Créer un compte gratuit</span>
                  <ArrowRight size={20} />
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                >
                  J'ai déjà un compte
                </button>
              </div>
            ) : (
              <>
                {/* File Input */}
                <div className="mb-6">
                  <label
                    htmlFor="file-input"
                    className="block w-full p-8 border-2 border-dashed border-gray-300 rounded-2xl hover:border-blue-500 cursor-pointer transition-all bg-gray-50 hover:bg-blue-50"
                  >
                    <div className="flex flex-col items-center">
                      <Upload className="text-blue-600 mb-4" size={40} />
                      <p className="text-gray-700 font-medium mb-1">
                        {file ? file.name : 'Cliquez pour choisir un PDF'}
                      </p>
                      <p className="text-sm text-gray-500">Maximum 10MB</p>
                    </div>
                  </label>
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {/* Upload Button */}
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className={`w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                    !file || uploading
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-xl hover:scale-105'
                  }`}
                >
                  {uploading ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      <span>Conversion en cours...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={20} />
                      <span>Convertir gratuitement</span>
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-gray-500 mt-4">
                  En convertissant, vous acceptez nos conditions d'utilisation
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Choisissez votre plan</h2>
          <p className="text-xl text-gray-600">Simple, transparent, sans engagement</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <PricingCard
            name="Free"
            price="0€"
            features={['5 conversions/mois', 'Export Excel', 'Support email']}
            cta="Commencer"
            onClick={() => navigate('/register')}
          />
          <PricingCard
            name="Premium"
            price="9.99€"
            period="/mois"
            highlight
            features={['50 conversions/mois', 'Export Excel & CSV', 'Support prioritaire', 'Historique illimité']}
            cta="Essayer Premium"
            onClick={() => navigate('/register')}
          />
          <PricingCard
            name="Pro"
            price="29.99€"
            period="/mois"
            features={['Conversions illimitées', 'API Access', 'Support 24/7', 'Personnalisation']}
            cta="Contacter"
            onClick={() => navigate('/register')}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="text-white" size={16} />
              </div>
              <span className="font-semibold text-gray-900">ComptaFlow</span>
            </div>
            <p className="text-sm text-gray-600">
              © 2025 ComptaFlow. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>

      {/* Modal "Créer un compte" */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)} navigate={navigate} />
      )}
    </div>
  );
}

// ============ COMPONENTS ============

function Feature({ icon, text }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-gray-700 font-medium">{text}</span>
    </div>
  );
}

function PricingCard({ name, price, period, features, cta, highlight, onClick }) {
  return (
    <div className={`bg-white rounded-2xl p-8 transition-all ${highlight ? 'ring-2 ring-blue-500 shadow-xl scale-105' : 'border border-gray-200 hover:shadow-lg'}`}>
      {highlight && (
        <div className="text-center mb-4">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
            POPULAIRE
          </span>
        </div>
      )}
      <h3 className="text-2xl font-bold text-gray-900 mb-2">{name}</h3>
      <div className="mb-6">
        <span className="text-4xl font-bold">{price}</span>
        {period && <span className="text-gray-600">{period}</span>}
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2">
            <Check className="text-green-500 flex-shrink-0" size={20} />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        className={`w-full py-3 rounded-xl font-semibold transition-all ${
          highlight
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg transform hover:scale-105'
            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

function Modal({ onClose, navigate }) {
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="text-green-600" size={32} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Conversion réussie ! 🎉</h3>
          <p className="text-gray-600">
            Créez un compte gratuit pour continuer à convertir vos relevés
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/register')}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            Créer un compte gratuit
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 transition-all"
          >
            J'ai déjà un compte
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-600 hover:text-gray-900 text-sm transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
