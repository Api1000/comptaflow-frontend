import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Upload, File, X, Loader, Zap } from 'lucide-react';

export default function FileUploader({ onUploadSuccess, onUploadError }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleValidateFile = (file) => {
    if (!file) return false;

    if (file.type !== 'application/pdf') {
      toast.error('Seuls les fichiers PDF sont acceptés');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Le fichier ne doit pas dépasser 10MB');
      return false;
    }

    return true;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (handleValidateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleChange = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      if (handleValidateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    setUploading(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);
	  formData.append('force_mistral', 'true'); 

	const response = await fetch(`${import.meta.env.VITE_API_URL}/upload?force_mistral=true`, {
	  method: 'POST',
	  headers: {
		'Authorization': `Bearer ${token}`
	  },
	  body: formData
	});

      const data = await response.json();

      // ✅ NOUVEAU : Gérer les différents statuts
      if (data.status === 'error') {
        // Erreur de validation (scan, banque non supportée, format incompatible)
        if (onUploadError) {
          onUploadError(data, selectedFile);
        }

        // Afficher un toast simple pour l'utilisateur
        const errorMessages = {
          'SCANNED_PDF': '❌ PDF scanné détecté',
          'BANK_NOT_SUPPORTED': '❌ Banque non supportée',
          'FORMAT_NOT_COMPATIBLE': '❌ Format incompatible'
        };
        toast.error(errorMessages[data.error_type] || '❌ Erreur de conversion');

        // Ne pas reset le fichier pour permettre le signalement
        return;
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Erreur lors de l\'upload');
      }

      // ✅ Succès
      if (data.status === 'success') {
        toast.success(`✅ ${data.transactions_count} transactions extraites !`);

        // Reset
        setSelectedFile(null);
        if (inputRef.current) {
          inputRef.current.value = '';
        }

        // Callback pour rafraîchir l'historique
        if (onUploadSuccess) {
          onUploadSuccess(data);
        }
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Zone de drag & drop */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ${
          dragActive
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-300 bg-white hover:border-purple-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
        />

        {!selectedFile ? (
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Glissez-déposez votre relevé PDF ici
            </p>
            <p className="text-sm text-gray-500 mb-4">ou</p>
            <button
              onClick={() => inputRef.current?.click()}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
            >
              Parcourir les fichiers
            </button>
            <p className="text-xs text-gray-400 mt-4">PDF jusqu'à 10MB</p>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 flex-1">
              <File className="w-8 h-8 text-purple-600" />
              <div className="flex-1">
                <p className="font-medium text-gray-800">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={uploading}
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        )}
      </div>

      {/* Bouton de conversion */}
      {selectedFile && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Conversion en cours...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Convertir en Excel
            </>
          )}
        </button>
      )}
    </div>
  );
}
