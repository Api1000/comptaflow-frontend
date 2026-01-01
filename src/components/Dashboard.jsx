import { useState, useEffect } from 'react';
import { Upload, FileText, Download, Zap, TrendingUp, Clock, AlertTriangle, Send, CheckCircle, Building2, Calendar, Hash } from 'lucide-react';
import { uploadAPI } from '../api/client';
import FileUploader from './FileUploader';
import ErrorAlert from './ErrorAlert';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [uploads, setUploads] = useState([]);
  const [stats, setStats] = useState({ total: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);

  // Gestion des erreurs de validation
  const [uploadError, setUploadError] = useState(null);
  const [failedFile, setFailedFile] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportComment, setReportComment] = useState('');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await uploadAPI.getHistory();
      console.log('📊 History response:', response.data);
      setUploads(response.data.uploads || []);

      const total = response.data.uploads?.length || 0;
      const thisMonth = response.data.uploads?.filter(u => {
        const date = new Date(u.created_at);
        const now = new Date();
        return date.getMonth() === now.getMonth() && 
               date.getFullYear() === now.getFullYear();
      }).length || 0;

      setStats({ total, thisMonth });
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (uploadId, filename) => {
    try {
      const response = await uploadAPI.download(uploadId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename.replace('.pdf', '_EXTRAIT.xlsx'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Téléchargement réussi !');
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleUploadSuccess = (response) => {
    setUploadError(null);
    setFailedFile(null);
    loadHistory();
  };

  const handleUploadError = (error, file) => {
    console.log('Upload error:', error);
    setUploadError(error);
    setFailedFile(file);
  };

  const handleOpenReportModal = () => {
    setShowReportModal(true);
  };

  const handleReportProblem = async () => {
    if (!failedFile) return;

    setReporting(true);

    const formData = new FormData();
    formData.append('file', failedFile);
    formData.append('bank_name', uploadError?.bank_detected || 'UNKNOWN');
    formData.append('error_message', uploadError?.message || '');
    formData.append('user_comment', reportComment);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/report-failed-conversion`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Merci pour votre signalement ! Nous ajouterons cette banque prochainement.', { 
          duration: 5000 
        });
        setUploadError(null);
        setFailedFile(null);
        setReportComment('');
        setShowReportModal(false);
      } else {
        toast.error('Erreur lors du signalement');
      }
    } catch (error) {
      console.error('Report error:', error);
      toast.error('Erreur lors du signalement');
    } finally {
      setReporting(false);
    }
  };

  // Fonction pour formater la date et l'heure
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    const timeFormatted = date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    return { date: dateFormatted, time: timeFormatted };
  };

  // Mapping des banques
  const getBankName = (bankType) => {
    if (!bankType) return 'Non détecté';

    const banks = {
      // Format long (backend actuel)
      'LCL': 'LCL - Crédit Lyonnais',
      'CREDIT_AGRICOLE': 'Crédit Agricole',
      'BANQUE_POPULAIRE': 'Banque Populaire',
      'SOCIETE_GENERALE': 'Société Générale',
      'BNP_PARIBAS': 'BNP Paribas',

      // Format court (rétrocompatibilité)
      'CA': 'Crédit Agricole',
      'BP': 'Banque Populaire',
      'SG': 'Société Générale',
      'BNP': 'BNP Paribas'
    };

    return banks[bankType] || bankType;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Convertissez vos relevés bancaires en quelques secondes
          </h1>
          <p className="text-lg text-gray-600">
            Uploadez votre relevé bancaire PDF
          </p>
        </div>

        {/* Bloc d'erreur */}
        {uploadError && (
          <ErrorAlert 
            error={uploadError}
            onClose={() => {
              setUploadError(null);
              setFailedFile(null);
            }}
            canReport={uploadError.can_report}
            onReport={handleOpenReportModal}
          />
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <FileUploader 
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            icon={<Zap className="w-6 h-6" />}
            title="Conversions ce mois"
            value={stats.thisMonth}
            subtitle="Rapide et sécurisé"
          />
          <StatsCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Total conversions"
            value={stats.total}
            subtitle="Depuis le début"
          />
          <StatsCard
            icon={<Clock className="w-6 h-6" />}
            title="Temps moyen"
            value="< 3 sec"
            subtitle="Conversion instantanée"
          />
        </div>

        {/* History Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <FileText className="w-6 h-6 text-purple-600" />
            Vos dernières conversions
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
            </div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">Aucune conversion pour le moment</p>
              <p className="text-gray-400">Uploadez votre premier fichier pour commencer</p>
            </div>
          ) : (
            <div className="space-y-4">
              {uploads.map((upload) => {
                const { date, time } = formatDateTime(upload.created_at);

                // ✅ UTILISER LES BONS NOMS DE CHAMPS DU BACKEND
                const filename = upload.file || upload.filename || 'Fichier sans nom';
                const bankType = upload.bank || upload.bank_type;
                const transactionCount = upload.count !== undefined ? upload.count : upload.transaction_count;
                const bankName = getBankName(bankType);

                // Debug
                console.log('📄 Upload:', {
                  id: upload.id,
                  filename: filename,
                  bank_type: bankType,
                  bank_name: bankName,
                  transaction_count: transactionCount
                });

                return (
                  <div
                    key={upload.id}
                    className="group bg-gradient-to-r from-gray-50 to-white rounded-xl p-5 hover:shadow-lg transition-all duration-200 border border-gray-100 hover:border-purple-200"
                  >
                    <div className="flex items-start gap-4">
                      {/* Icône de fichier */}
                      <div className="flex-shrink-0 p-3 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg">
                        <FileText className="w-8 h-8 text-purple-600" />
                      </div>

                      {/* Informations principales */}
                      <div className="flex-1 min-w-0">
                        {/* Nom du fichier */}
                        <h3 className="text-lg font-bold text-gray-900 mb-2 truncate group-hover:text-purple-600 transition-colors">
                          {filename}
                        </h3>

                        {/* Grille d'informations */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                          {/* Banque */}
                          <div className="flex items-center gap-2 text-gray-600">
                            <Building2 className="w-4 h-4 text-purple-500" />
                            <span className="font-medium">{bankName}</span>
                          </div>

                          {/* Transactions */}
                          <div className="flex items-center gap-2 text-gray-600">
                            <Hash className="w-4 h-4 text-indigo-500" />
                            <span>
                              {transactionCount !== undefined ? (
                                <>
                                  <span className="font-bold text-gray-900">{transactionCount}</span>
                                  {' '}transaction{transactionCount > 1 ? 's' : ''}
                                </>
                              ) : (
                                <span className="text-gray-400">Non disponible</span>
                              )}
                            </span>
                          </div>

                          {/* Date et heure */}
                          <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="w-4 h-4 text-green-500" />
                            <span>
                              {date} à {time}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bouton de téléchargement */}
                      <button
                        onClick={() => handleDownload(upload.id, filename)}
                        className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 group-hover:scale-105"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Télécharger</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal de signalement */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                📧 Signaler un problème
              </h3>

              <p className="text-gray-600 mb-4">
                Nous allons recevoir votre relevé et ajouter le support de votre banque dans les prochaines mises à jour.
              </p>

              {uploadError?.bank_detected && (
                <div className="bg-purple-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-700">
                    <strong>Banque détectée :</strong> {uploadError.bank_detected}
                  </p>
                </div>
              )}

              <textarea
                value={reportComment}
                onChange={(e) => setReportComment(e.target.value)}
                placeholder="Commentaire (optionnel)..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent mb-4 resize-none"
                rows={4}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={reporting}
                >
                  Annuler
                </button>
                <button
                  onClick={handleReportProblem}
                  disabled={reporting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {reporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Envoyer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Composant StatsCard
function StatsCard({ icon, title, value, subtitle }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
