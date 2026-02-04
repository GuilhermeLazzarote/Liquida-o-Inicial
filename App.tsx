
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import FileUpload from './components/FileUpload';
import Loader from './components/Loader';
import ResultsDisplay from './components/ResultsDisplay';
import { CalculoTrabalhista, HistoryItem } from './types';
import { processarCalculo } from './services/geminiService';
import { createSingleCalculationPdf } from './services/pdfService';
import { exportHistoryToExcel, exportHistoryToPdf } from './services/exportService';
import useLocalStorage from './hooks/useLocalStorage';
import History from './components/History';
import { DownloadIcon, PencilIcon } from './components/icons';

type AppState = 'idle' | 'loading' | 'success' | 'error';

const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<AppState>('idle');
  const [result, setResult] = useState<CalculoTrabalhista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('calculo-history', []);
  const [currentHistoryItemId, setCurrentHistoryItemId] = useState<string | null>(null);
  const [calculationObservation, setCalculationObservation] = useState<string>('');
  const [inssPatronalPercent, setInssPatronalPercent] = useState<string>('23');
  
  // Modelo Flash é o padrão absoluto para garantir quota de 100+ calcs/dia
  const [modelMode, setModelMode] = useState<'gemini-3-pro-preview' | 'gemini-3-flash-preview'>('gemini-3-flash-preview');

  const [isEditing, setIsEditing] = useState(false);
  const [originalResultBeforeEdit, setOriginalResultBeforeEdit] = useState<CalculoTrabalhista | null>(null);

  const handleFilesSelect = (files: File[]) => {
    const validFiles = files.filter(file => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            alert(`O arquivo "${file.name}" excede o limite de ${MAX_FILE_SIZE_MB}MB.`);
            return false;
        }
        return true;
    });
    
    setSelectedFiles(prevFiles => {
        const newFiles = validFiles.filter(vf => !prevFiles.some(pf => pf.name === vf.name && pf.size === vf.size));
        return [...prevFiles, ...newFiles];
    });

    setStatus('idle');
    setError(null);
    setResult(null);
  };

  const removeFileFromSelection = (fileToRemove: File) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
  };
  
  const handleStartProcessing = async () => {
    if (selectedFiles.length === 0) return;

    setStatus('loading');
    setError(null);
    setResult(null);
    setCurrentHistoryItemId(null);

    const file = selectedFiles[0];
    
    try {
        setLoadingStatus(`Realizando Liquidação Técnica Pericial: ${file.name}`);
        
        const calculoResult = await processarCalculo(
            file,
            calculationObservation,
            null,
            '',
            '',
            inssPatronalPercent,
            modelMode
        ); 
        
        const newHistoryItem: HistoryItem = {
          id: uuidv4(),
          fileName: file.name,
          result: { 
            ...calculoResult, 
            observation: calculoResult.observation || calculationObservation,
            calculationSource: "AI_CALCULATED",
            percentualInssReclamada: parseFloat(inssPatronalPercent) || 23
          }, 
          timestamp: Date.now(),
        };
        
        setHistory(prevHistory => [newHistoryItem, ...prevHistory]);
        setResult(newHistoryItem.result);
        setCurrentHistoryItemId(newHistoryItem.id);
        
        if (calculoResult.isCalculationPossible) {
            setStatus('success');
        } else {
            setError(calculoResult.errorReason || "Verifique se o documento contém os dados necessários para o cálculo.");
            setStatus('error');
        }
    } catch (err: any) {
        console.error(err);
        setError(err.message || "Erro inesperado ao processar a liquidação.");
        setStatus('error');
    }
    
    setLoadingStatus('');
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setStatus('idle');
    setResult(null);
    setError(null);
    setIsEditing(false); 
    setOriginalResultBeforeEdit(null);
    setCalculationObservation('');
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setIsEditing(false);
    setResult(item.result);
    setStatus('success');
    setError(null);
    setCurrentHistoryItemId(item.id);
  };

  const handleStartEdit = () => {
    if (result) {
        setOriginalResultBeforeEdit(JSON.parse(JSON.stringify(result)));
        setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
      if (originalResultBeforeEdit) setResult(originalResultBeforeEdit);
      setIsEditing(false);
  };

  const handleSaveChanges = () => {
      if (result && currentHistoryItemId) {
          setHistory(prevHistory => {
              const newHistory = [...prevHistory];
              const itemIdx = newHistory.findIndex(i => i.id === currentHistoryItemId);
              if (itemIdx > -1) newHistory[itemIdx].result = result;
              return newHistory;
          });
      }
      setIsEditing(false);
      alert('Laudo pericial atualizado com sucesso.');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <History 
        history={history}
        onSelect={handleHistorySelect}
        onClear={() => { if(window.confirm('Limpar histórico de cálculos?')) setHistory([]); }}
        currentItemId={currentHistoryItemId}
        onExportExcel={() => exportHistoryToExcel(history)}
        onExportPdf={() => exportHistoryToPdf(history.map(item => item.result))}
      />
      <main className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto text-center mb-8">
            <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tighter">LIQUIDAÇÃO DE SENTENÇA</h1>
            <div className="h-1.5 w-24 bg-blue-600 mx-auto mt-4 rounded-full"></div>
            <p className="text-gray-500 mt-4 text-sm font-bold uppercase tracking-widest">Apurador Pericial de Haveres Trabalhistas</p>
        </div>
        
        {status === 'idle' && (
          <div className="w-full max-w-2xl flex flex-col items-center">
            
            <div className="w-full mb-6 bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between shadow-lg">
                <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Sistema de Processamento Profissional</span>
                </div>
                <div className="flex bg-gray-800 p-1 rounded-lg">
                    <button 
                        onClick={() => setModelMode('gemini-3-flash-preview')}
                        className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${modelMode === 'gemini-3-flash-preview' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        ALTA CAPACIDADE
                    </button>
                    <button 
                        onClick={() => setModelMode('gemini-3-pro-preview')}
                        className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${modelMode === 'gemini-3-pro-preview' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                        PRECISÃO EXTRA
                    </button>
                </div>
            </div>

            <FileUpload 
              onFilesSelect={handleFilesSelect} 
              selectedFiles={selectedFiles} 
              removeFile={removeFileFromSelection}
            />

            {selectedFiles.length > 0 && (
                <div className="w-full mt-6 flex flex-col items-center space-y-4 animate-fade-in">
                    <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-black text-gray-500 mb-1 uppercase tracking-widest">Diretrizes da Perícia</label>
                            <textarea
                                className="w-full p-4 border border-gray-300 rounded-xl shadow-sm text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                rows={2}
                                placeholder="Especifique parâmetros para a liquidação técnica..."
                                value={calculationObservation}
                                onChange={(e) => setCalculationObservation(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-black text-gray-500 mb-1 uppercase tracking-widest">INSS Patronal %</label>
                            <input
                                type="number"
                                className="w-full p-4 border border-gray-300 rounded-xl shadow-sm text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={inssPatronalPercent}
                                onChange={(e) => setInssPatronalPercent(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex space-x-4">
                        <button 
                            onClick={handleStartProcessing}
                            className="bg-blue-600 text-white font-black uppercase px-14 py-4 rounded-xl hover:bg-blue-700 shadow-xl transition-all active:scale-95 text-lg"
                        >
                            Liquidar Cálculos
                        </button>
                        <button onClick={clearSelection} className="text-gray-400 font-bold px-4 py-4 hover:text-gray-600">Limpar</button>
                    </div>
                </div>
            )}
          </div>
        )}
        
        {status === 'loading' && <Loader status={loadingStatus} />}
        
        {status === 'error' && (
            <div className="w-full max-w-2xl bg-white border-2 border-red-50 border-red-200 p-8 rounded-2xl shadow-xl text-center animate-fade-in">
                <div className="text-red-500 text-5xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Interrupção no Processamento</h2>
                <p className="text-gray-600 mb-6 italic bg-red-50 p-4 rounded-lg border border-red-100">{error}</p>
                <button onClick={clearSelection} className="bg-gray-900 text-white font-bold py-3 px-10 rounded-xl hover:bg-black transition-all">Voltar para Início</button>
            </div>
        )}

        {status === 'success' && result && (
            <div className="w-full animate-fade-in">
                <div className="flex justify-center mb-8 space-x-4">
                    {!isEditing && (
                        <>
                            <button onClick={handleStartEdit} className="flex items-center space-x-2 bg-amber-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-amber-600 transition-all">
                                <PencilIcon className="h-5 w-5" />
                                <span>Ajustar Memória</span>
                            </button>
                            <button onClick={() => createSingleCalculationPdf(result)} className="flex items-center space-x-2 bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-emerald-700 transition-all">
                                <DownloadIcon className="h-5 w-5" />
                                <span>Exportar Laudo PDF</span>
                            </button>
                            <button onClick={clearSelection} className="bg-white border border-gray-200 text-gray-400 font-bold px-6 py-3 rounded-xl hover:bg-gray-50 transition-all">Nova Liquidação</button>
                        </>
                    )}
                </div>
                <ResultsDisplay 
                    result={result} 
                    isEditing={isEditing}
                    onResultChange={setResult}
                    onSave={handleSaveChanges}
                    onCancel={handleCancelEdit}
                />
            </div>
        )}

        <div className="mt-12 text-gray-400 text-[10px] font-bold uppercase tracking-widest text-center">
            Perícia Técnica Judiciária • Documento Gerado com Rigor Contábil • 2025
        </div>
      </main>
    </div>
  );
}

export default App;
