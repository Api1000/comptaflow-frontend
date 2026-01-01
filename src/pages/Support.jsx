// Suite et fin de Support.jsx
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
            {/* Email (pré-rempli) */}
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

          {/* Info supplémentaire */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  Nous vous répondrons rapidement
                </p>
                <p className="text-sm text-blue-700">
                  Notre équipe traite tous les messages sous 24h ouvrées. Pour les problèmes urgents, 
                  incluez "URGENT" dans le sujet.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resources Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Ressources utiles
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Guide de démarrage */}
            <a
              href="#"
              className="p-6 border border-gray-200 rounded-lg hover:border-purple-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Book className="w-5 h-5 text-purple-600" />
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Guide de démarrage</h3>
              <p className="text-sm text-gray-600">
                Apprenez à convertir votre premier relevé en 3 minutes
              </p>
            </a>

            {/* Documentation */}
            <a
              href="#"
              className="p-6 border border-gray-200 rounded-lg hover:border-purple-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Documentation API</h3>
              <p className="text-sm text-gray-600">
                Intégrez ComptaFlow dans vos outils (développeurs)
              </p>
            </a>

            {/* Tutoriels vidéo */}
            <a
              href="#"
              className="p-6 border border-gray-200 rounded-lg hover:border-purple-400 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-green-600 transition-colors" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Tutoriels vidéo</h3>
              <p className="text-sm text-gray-600">
                Regardez nos guides pas-à-pas en vidéo
              </p>
            </a>

            {/* Contact direct */}
            <div className="p-6 border border-gray-200 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50">
              <div className="p-2 bg-purple-100 rounded-lg w-fit mb-3">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Email direct</h3>
              <a 
                href="mailto:support@comptaflow.fr" 
                className="text-sm text-purple-600 hover:text-purple-700 font-semibold"
              >
                support@comptaflow.fr
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
