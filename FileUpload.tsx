
import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon, FileIcon, TrashIcon } from './icons';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  removeFile: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, selectedFiles, removeFile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelect(Array.from(e.dataTransfer.files));
    }
  }, [onFilesSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelect(Array.from(e.target.files));
    }
  };

  if (selectedFiles.length > 0) {
    return (
      <div className="w-full max-w-2xl bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 px-2">Arquivos Selecionados</h3>
        <div className="max-h-60 overflow-y-auto pr-2">
            <ul className="space-y-2">
            {selectedFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                    <div className="flex items-center space-x-3 overflow-hidden">
                        <FileIcon className="h-8 w-8 text-blue-500 flex-shrink-0" />
                        <div className="truncate">
                            <p className="font-medium text-gray-800 truncate">{file.name}</p>
                            <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => removeFile(file)}
                        className="p-2 rounded-full hover:bg-red-100 text-red-500 transition-colors duration-200 ml-3"
                        aria-label={`Remover arquivo ${file.name}`}
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </li>
            ))}
            </ul>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`w-full max-w-2xl border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
      }`}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/webp, application/pdf"
        multiple // Allow multiple files
      />
      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
        <UploadIcon className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700">Arraste e solte os documentos aqui</h3>
        <p className="text-gray-500 mt-1">ou</p>
        <span className="mt-2 inline-block bg-blue-600 text-white font-semibold px-6 py-2 rounded-md hover:bg-blue-700 transition-colors">
          Selecione os arquivos
        </span>
        <p className="text-xs text-gray-400 mt-4">PNG, JPG, WEBP ou PDF</p>
        <p className="text-xs text-gray-400">Envie petições, sentenças ou acórdãos.</p>
      </label>
    </div>
  );
};

export default FileUpload;