import { useState } from 'react';
import { 
  HelpCircle, 
  Mail, 
  MessageSquare, 
  Book, 
  FileText, 
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Send,
  Clock,
  Users,
  Zap,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export default function Support() {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: ''
  });
  const [sending, setSending] = useState(false);

  const faqs = [
    {
      id: 1,
      question: "Quels formats de relevés bancaires sont supportés ?",
      answer: "ComptaFlow supporte actuellement les relevés PDF des banques suivantes : LCL - Crédit Lyonnais, Crédit Agricole, et Banque Populaire. Les PDFs doivent être des documents natifs (non scannés). Nous ajoutons régulièrement de nouvelles banques !"
    },
    {
      id: 2,
      question: "Pourquoi mon PDF scanné ne fonctionne pas ?",
      answer: "Les PDFs scannés (photos ou scans de relevés papier) ne sont pas encore supportés. Nous travaillons activement sur l'intégration de l'OCR (reconnaissance optique de caractères). En attendant, téléchargez vos relevés directement depuis votre espace client bancaire en ligne."
    },
    {
      id: 3,
      question: "Combien de conversions puis-je faire par mois ?",
      answer: "Plan FREE : 5 conversions/mois\nPlan PREMIUM : 50 conversions/mois\nPlan PRO : Conversions illimitées\n\nLe compteur se réinitialise le 1er de chaque mois."
    },
    {
      id: 4,
      question: "Mes données sont-elles sécurisées ?",
      answer: "Absolument ! Vos relevés sont traités de manière sécurisée. Les PDFs sont analysés temporairement puis supprimés. Seul le fichier Excel converti est conservé pour votre historique. Nous n'avons accès à aucune de vos données bancaires sensibles."
    },
    {
      id: 5,
      question: "Comment annuler mon abonnement ?",
      answer: "Cliquez sur votre avatar en haut à droite, puis sur 'Gérer mon abonnement'. Vous serez redirigé vers le portail Stripe où vous pourrez annuler ou modifier votre abonnement à tout moment. Aucun frais d'annulation."
    },
    {
      id: 6,
      question: "Le format de ma banque a changé, que faire ?",
      answer: "Si votre banque a modifié le format de ses relevés, signalez-le nous via le formulaire ci-dessous. Joignez un relevé (anonymisé si possible) et nous mettrons à jour notre système rapidement."
    },
    {
      id: 7,
      question: "Puis-je convertir des relevés de plusieurs banques ?",
      answer: "Oui ! Si votre banque est supportée, vous pouvez convertir autant de relevés de banques différentes que vous le souhaitez (dans la limite de votre forfait mensuel)."
    },
    {
      id: 8,
      question: "Le fichier Excel généré contient-il des formules ?",
      answer: "Le fichier Excel contient vos transactions avec 3 colonnes : Date, Libellé, Montant. Le fichier est prêt à être utilisé dans Excel, Google Sheets, ou tout logiciel comptable. Vous pouvez ajouter vos propres formules selon vos besoins."
    }
  ];

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id);
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!contactForm.subject || !contactForm.message) {
    toast.error('Veuillez remplir tous les champs');
    return;
  }

  setSending(true);

  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${import.meta.env.VITE_API_URL}/support/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        subject: contactForm.subject,
        message: contactForm.message
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      toast.success('✅ Message envoyé ! Nous vous répondrons sous 24h.', {
        duration: 5000
      });
      
      // Reset le formulaire
      setContactForm({ subject: '', message: '' });
    } else {
      throw new Error(data.message || 'Erreur serveur');
    }
  } catch (error) {
    console.error('❌ Support message error:', error);
    toast.error('❌ Erreur lors de l\'envoi. Réessayez plus tard.');
  } finally {
    setSending(false);
  }
};


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full mb-4">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Centre d'aide et support
          </h1>
          <p className="text-lg text-gray-600">
            Besoin d'aide ? Consultez notre FAQ ou contactez-nous directement
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Temps de réponse</p>
                <p className="text-2xl font-bold text-gray-900">{'<'} 24h</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Utilisateurs actifs</p>
                <p className="text-2xl font-bold text-gray-900">500+</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Banques supportées</p>
                <p className="text-2xl font-bold text-gray-900">3+</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Book className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Questions fréquentes
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:border-purple-300 transition-colors"
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 pr-4">
                    {faq.question}
                  </span>
                  {openFaq === faq.id ? (
                    <ChevronUp className="w-5 h-5 text-purple-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>

                {openFaq === faq.id && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 animate-slideDown">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <MessageSquare className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Contactez-nous
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Votre email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
            </div>

            {/* Sujet */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Sujet
              </label>
              <input
                type="text"
                value={contactForm.subject}
                onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                placeholder="Ex: Problème de conversion pour ma banque"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                required
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Message
              </label>
              <textarea
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                placeholder="Décrivez votre problème ou votre question en détail..."
                rows="6"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition resize-none"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={sending}
              className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              {sending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Envoyer le message
                </>
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  Nous vous répondrons rapidement
                </p>
                <p className="text-sm text-blue-700">
                  Notre équipe traite tous les messages sous 24h ouvrées. 
                </p>
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}
