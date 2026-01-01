import { useState } from 'react';
import { 
  Bug, 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DebugPDF() {
  const [file, setFile] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    text: false,
    keywords: true,
    validation: true,
    lines: false
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Seuls les fichiers PDF sont acceptés');
        return;
      }
      setFile(selectedFile);
      setDebugInfo(null);
    }
  };

  const handleDebug = async () => {
    if (!file) {
      toast.error('Veuillez sélectionner un fichier PDF');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/debug-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Erreur lors du diagnostic');
      }

      const data = await response.json();
      setDebugInfo(data);
      toast.success('Diagnostic terminé !');
      
      // Log dans la console pour copier facilement
      console.log('🔍 DEBUG INFO:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ Debug error:', error);
      toast.error('Erreur lors du diagnostic');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papier !');
  };

  const downloadJSON = () => {
    const dataStr = JSON.stringify(debugInfo, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `debug-${file.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Fichier JSON téléchargé !');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full mb-4">
            <Bug className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Mode Debug PDF
          </h1>
          <p className="text-lg text-gray-600">
            Diagnostiquez les problèmes de conversion en détail
          </p>
        </div>

        {/* File Upload */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Upload className="w-6 h-6 text-orange-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              1. Sélectionner un fichier PDF
            </h2>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-orange-400 transition-colors">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
              id="debug-file-input"
            />
            <label
              htmlFor="debug-file-input"
              className="cursor-pointer"
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-orange-600" />
                  <div>
                    <p className="font-semibold text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-semibold mb-1">
                    Cliquez pour sélectionner un PDF
                  </p>
                  <p className="text-sm text-gray-500">
                    ou glissez-déposez un fichier
                  </p>
                </div>
              )}
            </label>
          </div>

          <button
            onClick={handleDebug}
            disabled={!file || loading}
            className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold rounded-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                <Bug className="w-5 h-5" />
                Lancer le diagnostic
              </>
            )}
          </button>
        </div>

        {/* Debug Results */}
        {debugInfo && (
          <div className="space-y-6">
            
            {/* Summary */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  📊 Résumé du diagnostic
                </h2>
                <button
                  onClick={downloadJSON}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Télécharger JSON
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Fichier</p>
                  <p className="font-bold text-gray-900 truncate">{debugInfo.filename}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Taille</p>
                  <p className="font-bold text-gray-900">{(debugInfo.file_size / 1024).toFixed(2)} KB</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Type</p>
                  <p className="font-bold text-gray-900">
                    {debugInfo.is_scanned ? '📸 Scanné' : '📄 Natif'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Méthode d'extraction</p>
                  <p className="font-bold text-gray-900">{debugInfo.extraction_method}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Texte extrait</p>
                  <p className="font-bold text-gray-900">{debugInfo.text_length} caractères</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Lignes détectées</p>
                  <p className="font-bold text-gray-900">{debugInfo.lines_count} lignes</p>
                </div>
              </div>
            </div>

            {/* Bank Detection */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                {debugInfo.bank_detected ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <h2 className="text-2xl font-bold text-gray-900">
                  🏦 Détection de la banque
                </h2>
              </div>

              {debugInfo.bank_detected ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-bold text-lg">
                    ✅ Banque détectée : {debugInfo.bank_detected}
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-bold">
                    ❌ Aucune banque détectée
                  </p>
                </div>
              )}

              {/* Keywords Found */}
              <div className="mt-6">
                <button
                  onClick={() => toggleSection('keywords')}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="font-semibold text-gray-900">
                    Mots-clés trouvés par banque
                  </span>
                  {expandedSections.keywords ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>

                {expandedSections.keywords && (
                  <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-2">
                    {Object.keys(debugInfo.bank_keywords_found).length > 0 ? (
                      Object.entries(debugInfo.bank_keywords_found).map(([bank, keywords]) => (
                        <div key={bank} className="p-3 bg-white rounded border border-gray-200">
                          <p className="font-bold text-gray-900 mb-2">{bank}</p>
                          <div className="flex flex-wrap gap-2">
                            {keywords.map((keyword, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-600 italic">Aucun mot-clé bancaire trouvé</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Validation Result */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                {debugInfo.validation_result.compatible ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                )}
                <h2 className="text-2xl font-bold text-gray-900">
                  ✓ Résultat de validation
                </h2>
              </div>

              <div className={`p-4 rounded-lg border ${
                debugInfo.validation_result.compatible
                  ? 'bg-green-50 border-green-200'
                  : 'bg-orange-50 border-orange-200'
              }`}>
                <p className={`font-bold mb-2 ${
                  debugInfo.validation_result.compatible ? 'text-green-800' : 'text-orange-800'
                }`}>
                  {debugInfo.validation_result.compatible ? '✅ Compatible' : '⚠️ Non compatible'}
                </p>
                <p className={`text-sm ${
                  debugInfo.validation_result.compatible ? 'text-green-700' : 'text-orange-700'
                }`}>
                  {debugInfo.validation_result.message}
                </p>
              </div>

              <button
                onClick={() => toggleSection('validation')}
                className="w-full mt-4 flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="font-semibold text-gray-900">
                  Détails complets de validation
                </span>
                {expandedSections.validation ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {expandedSections.validation && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(debugInfo.validation_result, null, 2)}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(debugInfo.validation_result, null, 2))}
                    className="mt-3 px-3 py-1 bg-white border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copier
                  </button>
                </div>
              )}
            </div>

            {/* Text Preview */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-6 h-6 text-purple-600" />
                <h2 className="text-2xl font-bold text-gray-900">
                  📝 Aperçu du texte extrait
                </h2>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Premiers 1000 caractères extraits du PDF
                </p>
                <div className="max-h-64 overflow-y-auto">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                    {debugInfo.text_preview}
                  </pre>
                </div>
              </div>

              <button
                onClick={() => toggleSection('text')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="font-semibold text-gray-900">
                  Voir le texte complet ({debugInfo.text_length} caractères)
                </span>
                {expandedSections.text ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {expandedSections.text && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">
                    ℹ️ Le texte complet n'est disponible que dans le JSON téléchargé
                  </p>
                </div>
              )}
            </div>

            {/* First 50 Lines */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-6 h-6 text-indigo-600" />
                <h2 className="text-2xl font-bold text-gray-900">
                  📋 Premières lignes détectées
                </h2>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Les 50 premières lignes non-vides extraites (utilisées pour le parsing)
              </p>

              <button
                onClick={() => toggleSection('lines')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="font-semibold text-gray-900">
                  Afficher les lignes ({debugInfo.first_50_lines.length} lignes)
                </span>
                {expandedSections.lines ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {expandedSections.lines && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
                  <div className="space-y-1">
                    {debugInfo.first_50_lines.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex gap-3 text-xs font-mono hover:bg-white px-2 py-1 rounded transition-colors"
                      >
                        <span className="text-gray-400 flex-shrink-0 w-8 text-right">
                          {idx + 1}
                        </span>
                        <span className="text-gray-700 flex-1">
                          {line || <span className="text-gray-400 italic">(vide)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => copyToClipboard(debugInfo.first_50_lines.join('\n'))}
                    className="mt-4 px-3 py-1 bg-white border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copier toutes les lignes
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl shadow-xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-4">
                🚀 Prochaines étapes
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Téléchargez le rapport JSON complet</p>
                    <p className="text-sm opacity-90">
                      Utilisez le bouton "Télécharger JSON" en haut pour sauvegarder tous les détails
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Partagez les informations avec le support</p>
                    <p className="text-sm opacity-90">
                      Envoyez le fichier JSON au support pour résoudre le problème rapidement
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Vérifiez la console du navigateur</p>
                    <p className="text-sm opacity-90">
                      Appuyez sur F12 pour voir les détails complets dans la console
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Empty State */}
        {!debugInfo && !loading && (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Bug className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Aucun diagnostic en cours
            </h3>
            <p className="text-gray-600">
              Sélectionnez un fichier PDF ci-dessus pour commencer le diagnostic
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
