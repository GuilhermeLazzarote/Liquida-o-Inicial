
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import FileUpload from './components/FileUpload.tsx';
import Loader from './components/Loader.tsx';
import ResultsDisplay from './components/ResultsDisplay.tsx';
import { CalculoTrabalhista, HistoryItem } from './types';
import { processarCalculo } from './services/geminiService';
import { createSingleCalculationPdf } from './services/pdfService';
import { exportHistoryToExcel, exportHistoryToPdf } from './services/exportService';
import useLocalStorage from './hooks/useLocalStorage';
import History from './components/History.tsx';
import { DownloadIcon, PencilIcon } from './components/icons';

type AppState = 'idle' | 'loading' | 'success' | 'error';

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
  const [modelMode, setModelMode] = useState<'gemini-3-pro-preview' | 'gemini-3-flash-preview'>('gemini-3-flash-preview');
  const [isEditing, setIsEditing] = useState(false);

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(files);
    setStatus('idle');
    setError(null);
  };

  const removeFile = (file: File) => {
    setSelectedFiles(prev => prev.filter(f => f !== file));
  };

  const handleStart = async () => {
    if (selectedFiles.length === 0) return;
    setStatus('loading');
    setLoadingStatus('Realizando Liquidação Técnica Pericial...');

    try {
      const res = await processarCalculo(selectedFiles[0], calculationObservation, null, '', '', inssPatronalPercent, modelMode);
      const item: HistoryItem = { id: uuidv4(), fileName: selectedFiles[0].name, result: { ...res, percentualInssReclamada: parseFloat(inssPatronalPercent) }, timestamp: Date.now() };
      setHistory(prev => [item, ...prev]);
      setResult(item.result);
      setCurrentHistoryItemId(item.id);
      setStatus('success');
    } catch (e: any) {
      setError(e.message);
      setStatus('error');
    }
  };

  const handleNew = () => {
    setSelectedFiles([]);
    setStatus('idle');
    setResult(null);
    setError(null);
    setCalculationObservation('');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      <History 
        history={history} 
        onSelect={(i) => { setResult(i.result); setCurrentHistoryItemId(i.id); setStatus('success'); }} 
        onClear={() => setHistory([])} 
        currentItemId={currentHistoryItemId} 
        onExportExcel={() => exportHistoryToExcel(history)} 
        onExportPdf={() => exportHistoryToPdf(history.map(h => h.result))} 
      />
      <main className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
        <header className="mb-12 text-center animate-fade-in">
          <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tighter">PERÍCIA TRABALHISTA</h1>
          <div className="h-2 w-24 bg-blue-600 mx-auto mt-4 rounded-full"></div>
          <p className="text-gray-400 mt-4 text-[10px] font-black uppercase tracking-widest text-center">Apurador de Liquidação Judicial</p>
        </header>

        {status === 'idle' && (
          <div className="w-full max-w-2xl animate-fade-in">
             <div className="mb-6 bg-slate-900 p-4 rounded-2xl flex justify-between items-center shadow-xl">
                <div className="flex items-center space-x-3 ml-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Capacidade: 100+ Cálculos/Dia</span>
                </div>
                <div className="flex bg-gray-800 p-1 rounded-xl">
                    <button onClick={() => setModelMode('gemini-3-flash-preview')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${modelMode.includes('flash') ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}>Alta Carga</button>
                    <button onClick={() => setModelMode('gemini-3-pro-preview')} className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${modelMode.includes('pro') ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}>Precisão Pro</button>
                </div>
             </div>
             <FileUpload onFilesSelect={handleFilesSelect} selectedFiles={selectedFiles} removeFile={removeFile} />
             {selectedFiles.length > 0 && (
               <div className="mt-8 flex flex-col items-center space-y-6 w-full">
                  <div className="w-full grid grid-cols-4 gap-4">
                    <div className="col-span-3">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">Diretrizes Periciais</label>
                        <textarea value={calculationObservation} onChange={e => setCalculationObservation(e.target.value)} className="w-full p-5 border border-gray-200 rounded-2xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all" rows={2} placeholder="Especifique parâmetros (Ex: Diferenças Salariais 2023)..." />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-2">INSS Pat. %</label>
                        <input type="number" value={inssPatronalPercent} onChange={e => setInssPatronalPercent(e.target.value)} className="w-full p-5 border border-gray-200 rounded-2xl text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500 text-center font-bold" />
                    </div>
                  </div>
                  <button onClick={handleStart} className="bg-blue-600 text-white font-black uppercase tracking-tighter text-xl px-16 py-5 rounded-2xl shadow-2xl hover:bg-blue-700 active:scale-95 transition-all">Liquidar Processo</button>
               </div>
             )}
          </div>
        )}

        {status === 'loading' && <Loader status={loadingStatus} />}
        {status === 'error' && (
            <div className="text-center bg-white p-12 rounded-3xl shadow-2xl border border-red-100 max-w-xl animate-fade-in">
                <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-red-500 text-5xl">⚠️</span>
                </div>
                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter mb-4">Falha no Processamento</h2>
                <p className="text-gray-500 text-sm italic mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-100 leading-relaxed">{error}</p>
                <button onClick={() => setStatus('idle')} className="bg-gray-900 text-white px-12 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all">Reiniciar</button>
            </div>
        )}

        {status === 'success' && result && (
            <div className="w-full animate-fade-in">
                <div className="flex justify-center space-x-6 mb-10">
                    <button onClick={() => setIsEditing(!isEditing)} className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center transition-all ${isEditing ? 'bg-amber-600 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
                        <PencilIcon className="h-4 w-4 mr-3" /> {isEditing ? 'Concluir Ajustes' : 'Ajustar Laudo'}
                    </button>
                    <button onClick={() => createSingleCalculationPdf(result)} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center hover:bg-emerald-700 transition-all">
                        <DownloadIcon className="h-4 w-4 mr-3" /> Baixar Laudo PDF
                    </button>
                    <button onClick={handleNew} className="bg-white border border-gray-200 text-gray-400 px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-50 transition-all">Novo Cálculo</button>
                </div>
                <ResultsDisplay result={result} isEditing={isEditing} onResultChange={setResult} onSave={() => setIsEditing(false)} />
            </div>
        )}

        <footer className="mt-auto py-12 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] text-center">
            Perícia Técnica Judiciária • Documento Gerado com Rigor Contábil • 2025
        </footer>
      </main>
    </div>
  );
}

export default App;
