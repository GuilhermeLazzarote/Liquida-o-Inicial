
import React from 'react';
import { HistoryItem } from '../types';
import { FileIcon, ClockIcon, ExcelIcon, PdfIcon } from './icons';

interface HistoryProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  currentItemId: string | null;
  onExportExcel: () => void;
  onExportPdf: () => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const History: React.FC<HistoryProps> = ({ history, onSelect, onClear, currentItemId, onExportExcel, onExportPdf }) => {
  if (history.length === 0) {
    return (
      <aside className="w-80 bg-gray-50 border-r border-gray-200 p-6 flex-col hidden md:flex">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Histórico</h2>
        <div className="flex-grow flex items-center justify-center text-center">
            <p className="text-gray-500">Nenhum cálculo foi realizado ainda.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-gray-50 border-r border-gray-200 flex-col hidden md:flex">
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">Histórico</h2>
        <div className="flex items-center space-x-2">
           <button 
              onClick={onExportExcel}
              className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={history.length === 0}
              title="Exportar para Excel"
            >
              <ExcelIcon className="h-5 w-5 text-green-700" />
            </button>
            <button 
              onClick={onExportPdf}
              className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={history.length === 0}
              title="Exportar para PDF"
            >
              <PdfIcon className="h-5 w-5 text-red-700" />
            </button>
            <button 
              onClick={onClear} 
              className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
              disabled={history.length === 0}
            >
              Limpar
            </button>
        </div>
      </div>
      <ul className="flex-grow overflow-y-auto p-2">
        {history.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => onSelect(item)}
              className={`w-full text-left p-3 rounded-lg flex items-start space-x-3 transition-colors ${
                currentItemId === item.id ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
            >
              <FileIcon className="h-6 w-6 text-gray-500 mt-1 flex-shrink-0" />
              <div className="flex-grow overflow-hidden">
                <p className="font-semibold text-gray-800 truncate">{item.fileName}</p>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <ClockIcon className="h-3 w-3 mr-1.5" />
                  <span>{new Date(item.timestamp).toLocaleString('pt-BR')}</span>
                </div>
                <div className="text-sm font-bold text-blue-700 mt-1">
                  <span>Valor Total Geral: {formatCurrency(item.result.valorTotalGeral)}</span>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default History;
