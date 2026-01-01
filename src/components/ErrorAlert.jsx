import React from 'react';
import { X, FileX, Building2, AlertCircle } from 'lucide-react';

export default function ErrorAlert({ error, onClose, canReport = false, onReport }) {
  if (!error) return null;

  const getIcon = (errorType) => {
    switch(errorType) {
      case 'SCANNED_PDF':
        return <FileX className="w-8 h-8 text-red-500" />;
      case 'BANK_NOT_SUPPORTED':
        return <Building2 className="w-8 h-8 text-orange-500" />;
      case 'FORMAT_NOT_COMPATIBLE':
        return <AlertCircle className="w-8 h-8 text-yellow-500" />;
      default:
        return <AlertCircle className="w-8 h-8 text-red-500" />;
    }
  };

  const getTitle = (errorType) => {
    switch(errorType) {
      case 'SCANNED_PDF':
        return 'PDF scanné détecté';
      case 'BANK_NOT_SUPPORTED':
        return 'Banque non supportée';
      case 'FORMAT_NOT_COMPATIBLE':
        return 'Format incompatible';
      default:
        return 'Erreur de conversion';
    }
  };

  const getColor = (errorType) => {
    switch(errorType) {
      case 'SCANNED_PDF':
        return 'from-red-50 to-red-100 border-red-300';
      case 'BANK_NOT_SUPPORTED':
        return 'from-orange-50 to-orange-100 border-orange-300';
      case 'FORMAT_NOT_COMPATIBLE':
        return 'from-yellow-50 to-yellow-100 border-yellow-300';
      default:
        return 'from-red-50 to-red-100 border-red-300';
    }
  };

  return (
    <div 
      className={`bg-gradient-to-br ${getColor(error.error_type)} border-2 rounded-xl p-6 mb-6 shadow-lg animate-slideDown`}
      style={{
        animation: 'slideDown 0.3s ease-out'
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0">
          {getIcon(error.error_type)}
        </div>

        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-800 mb-1">
            {getTitle(error.error_type)}
          </h3>
          {error.bank_detected && error.bank_detected !== 'UNKNOWN' && error.bank_detected !== 'SCANNED_PDF' && (
            <p className="text-sm text-gray-600">
              Banque détectée : <span className="font-semibold">{error.bank_detected}</span>
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="flex-shrink-0 p-2 hover:bg-white/50 rounded-lg transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Message */}
      <div className="bg-white/60 rounded-lg p-4 mb-4">
        <p className="text-gray-700 whitespace-pre-line leading-relaxed">
          {error.message}
        </p>
      </div>

      {/* Banques supportées (pour BANK_NOT_SUPPORTED) */}
      {error.error_type === 'BANK_NOT_SUPPORTED' && error.supported_banks && (
        <div className="bg-white/60 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            🏦 Banques actuellement supportées :
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            {Object.entries(error.supported_banks).map(([code, name]) => (
              <li key={code}>• {name}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bouton de signalement */}
      {canReport && (
        <div className="flex justify-end pt-4 border-t border-gray-300/50">
          <button
            onClick={onReport}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            📧 Signaler ce problème
          </button>
        </div>
      )}
    </div>
  );
}
