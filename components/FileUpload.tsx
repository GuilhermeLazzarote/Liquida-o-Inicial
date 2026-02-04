
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
      <div className="w-full max-w-2xl bg-white p-4 rounded-xl shadow-lg border border-gray-200 animate-fade-in">
        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 px-2">Processos em Análise</h3>
        <div className="max-h-60 overflow-y-auto pr-2">
            <ul className="space-y-3">
            {selectedFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center space-x-4 overflow-hidden">
                        <FileIcon className="h-10 w-10 text-blue-600 flex-shrink-0" />
                        <div className="truncate">
                            <p className="font-bold text-gray-800 truncate text-sm">{file.name}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => removeFile(file)}
                        className="p-2.5 rounded-full hover:bg-red-50 text-red-400 transition-all duration-200 ml-4 border border-transparent hover:border-red-100"
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
      className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 shadow-inner ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50/50'
      }`}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/webp, application/pdf"
        multiple
      />
      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center group">
        <div className="bg-white p-6 rounded-full shadow-md mb-6 transition-transform group-hover:scale-110">
          <UploadIcon className="h-12 w-12 text-blue-600" />
        </div>
        <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Arraste o Processo Judicial</h3>
        <p className="text-gray-400 mt-2 text-xs font-bold uppercase tracking-widest">ou clique para selecionar do computador</p>
        <div className="mt-8 flex items-center space-x-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border border-gray-200 px-4 py-2 rounded-full">
            <span>PDF</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span>IMG</span>
            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
            <span>MAX 15MB</span>
        </div>
      </label>
    </div>
  );
};

export default FileUpload;
