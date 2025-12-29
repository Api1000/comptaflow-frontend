import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Upload, File, X, Loader } from 'lucide-react';

export default function FileUploader({ onUploadSuccess }) {
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

      const response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Erreur lors de l\'upload');
      }

      const data = await response.json();
      
      toast.success(`✅ ${data.transactions_count} transactions extraites !`);
      
      // Reset
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }

      // Callback pour rafraîchir l'historique
      if (onUploadSuccess) {
        onUploadSuccess();
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Zone de drop */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 bg-gray-50 hover:border-blue-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf"
          onChange={handleChange}
          disabled={uploading}
        />

        <label
          htmlFor="file-upload"
          className="flex flex-col items-center cursor-pointer"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Upload className="text-blue-600" size={32} />
          </div>
          <p className="text-lg font-semibold text-gray-700 mb-2">
            Glissez votre PDF ici
          </p>
          <p className="text-sm text-gray-500">
            ou cliquez pour parcourir (max 10MB)
          </p>
        </label>
      </div>

      {/* Fichier sélectionné */}
      {selectedFile && (
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <File className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-600">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          <button
            onClick={handleRemoveFile}
            disabled={uploading}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X className="text-red-600" size={20} />
          </button>
        </div>
      )}

      {/* Bouton d'upload */}
      {selectedFile && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className={`w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
            uploading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:scale-105'
          }`}
        >
          {uploading ? (
            <>
              <Loader className="animate-spin" size={20} />
              <span>Upload en cours...</span>
            </>
          ) : (
            <>
              <Upload size={20} />
              <span>Uploader le PDF</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
