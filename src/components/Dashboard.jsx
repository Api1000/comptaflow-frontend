import { useState, useEffect } from 'react';
import { Upload, FileText, Download, Zap, TrendingUp, Clock } from 'lucide-react';
import { uploadAPI } from '../api/client';
import FileUploader from './FileUploader';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [uploads, setUploads] = useState([]);
  const [stats, setStats] = useState({ total: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await uploadAPI.getHistory();
      setUploads(response.data.uploads || []);
      
      const total = response.data.uploads?.length || 0;
      const thisMonth = response.data.uploads?.filter(u => {
        const date = new Date(u.created_at);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 rounded-3xl p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full -ml-24 -mb-24"></div>
        
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-2">Tableau de bord</h1>
          <p className="text-blue-100 text-lg">Convertissez vos relevés bancaires en quelques secondes</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={<FileText className="text-blue-600" size={28} />}
          title="Total conversions"
          value={stats.total}
          subtitle="Depuis le début"
          color="blue"
        />
        <StatCard
          icon={<TrendingUp className="text-green-600" size={28} />}
          title="Ce mois-ci"
          value={stats.thisMonth}
          subtitle="Conversions effectuées"
          color="green"
        />
        <StatCard
          icon={<Clock className="text-purple-600" size={28} />}
          title="Temps moyen"
          value="< 5s"
          subtitle="Par conversion"
          color="purple"
        />
      </div>

      {/* Upload Section */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
            <Upload className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nouvelle conversion</h2>
            <p className="text-gray-600">Uploadez votre relevé bancaire PDF</p>
          </div>
        </div>
        <FileUploader onUploadSuccess={loadHistory} />
      </div>

      {/* History */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
              <FileText className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Historique</h2>
              <p className="text-gray-600">Vos dernières conversions</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : uploads.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-gray-400" size={32} />
            </div>
            <p className="text-gray-600 text-lg">Aucune conversion pour le moment</p>
            <p className="text-gray-500 text-sm mt-2">Uploadez votre premier fichier pour commencer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {uploads.map((upload) => (
              <UploadCard
                key={upload.id}
                upload={upload}
                onDownload={handleDownload}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, subtitle, color }) {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    green: 'from-green-50 to-green-100 border-green-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 border transition-all duration-200 hover:scale-105 cursor-pointer shadow-sm hover:shadow-md`}>
      <div className="flex items-start justify-between mb-4">
        {icon}
        <Zap className="text-yellow-500" size={20} />
      </div>
      <p className="text-gray-600 text-sm font-medium mb-1">{title}</p>
      <p className="text-4xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-gray-500 text-sm">{subtitle}</p>
    </div>
  );
}

function UploadCard({ upload, onDownload }) {
  const getBankColor = (bank) => {
    const colors = {
      CA: 'bg-green-100 text-green-700',
      BP: 'bg-blue-100 text-blue-700',
      LCL: 'bg-red-100 text-red-700',
      SG: 'bg-purple-100 text-purple-700',
      BNP: 'bg-orange-100 text-orange-700',
    };
    return colors[bank] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200 group">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow transition-all">
          <FileText className="text-blue-600" size={24} />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{upload.file}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${getBankColor(upload.bank)}`}>
              {upload.bank}
            </span>
            <span className="text-sm text-gray-600">{upload.count} transactions</span>
            <span className="text-sm text-gray-500">
              {new Date(upload.created_at).toLocaleDateString('fr-FR')}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={() => onDownload(upload.id, upload.file)}
        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
      >
        <Download size={18} />
        <span className="font-medium">Télécharger</span>
      </button>
    </div>
  );
}
