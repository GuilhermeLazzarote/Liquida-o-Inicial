
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import FileUpload from './components/FileUpload';
import Loader from './components/Loader';
import ResultsDisplay from './components/ResultsDisplay';
import { CalculoTrabalhista, HistoryItem } from './types';
import { processarCalculo } from './services/geminiService';
import { createSingleCalculationPdf } from './services/pdfService';
import { exportSingleCalculationToExcel, exportHistoryToExcel, exportHistoryToPdf } from './services/exportService';
import useLocalStorage from './hooks/useLocalStorage';
import History from './components/History';
import { DownloadIcon, ExcelIcon, PencilIcon, TrashIcon } from './components/icons';

type AppState = 'idle' | 'loading' | 'success' | 'error';

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface VacationPeriod {
    startDate: string;
    endDate: string;
}

function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<AppState>('idle');
  const [result, setResult] = useState<CalculoTrabalhista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('calculo-history', []);
  const [currentHistoryItemId, setCurrentHistoryItemId] = useState<string | null>(null);
  const [calculationObservation, setCalculationObservation] = useState<string>('');
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [thirteenthSalaryDetails, setThirteenthSalaryDetails] = useState<string>('');
  const [vestingDetails, setVestingDetails] = useState<string>('');
  const [inssPatronalPercent, setInssPatronalPercent] = useState<string>('23');
  
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
  
  const handleStartBatchProcessing = async () => {
    setStatus('loading');
    setError(null);
    setResult(null);
    setCurrentHistoryItemId(null);

    let successCount = 0;
    let failedCount = 0;
    const totalFiles = selectedFiles.length;
    const filesToProcess = [...selectedFiles];
    const processedFileNames: string[] = [];
    let quotaExceeded = false;

    for (const [index, file] of filesToProcess.entries()) {
      try {
        setLoadingStatus(`Liquidando ${index + 1} de ${totalFiles}: ${file.name}`);
        const calculoResult = await processarCalculo(
            file,
            calculationObservation,
            vacationPeriods,
            thirteenthSalaryDetails,
            vestingDetails,
            inssPatronalPercent
        ); 
        
        const newHistoryItem: HistoryItem = {
          id: uuidv4(),
          fileName: file.name,
          result: { 
            ...calculoResult, 
            observation: calculoResult.observation || calculationObservation,
            calculationSource: calculoResult.calculationSource || (calculoResult.isCalculationPossible ? "AI_CALCULATED" : ""),
            percentualInssReclamada: parseFloat(inssPatronalPercent) || calculoResult.percentualInssReclamada
          }, 
          timestamp: Date.now(),
        };
        setHistory(prevHistory => [newHistoryItem, ...prevHistory]);

        if (calculoResult.isCalculationPossible) {
            successCount++;
        } else {
            failedCount++;
        }
        processedFileNames.push(file.name);
      } catch (err: any) {
        console.error(`Falha no processamento:`, err);
        failedCount++;

        if (err.message?.includes('LIMITE_QUOTA')) {
            quotaExceeded = true;
            setError(err.message.replace('LIMITE_QUOTA: ', ''));
            break; 
        }

        const newHistoryItem: HistoryItem = {
            id: uuidv4(),
            fileName: file.name,
            result: {
                reclamante: "Erro", reclamada: "Erro", numeroProcesso: "Erro", verbas: [], totalBruto: 0,
                inss: 0, irrf: 0, totalLiquido: 0, juros: 0, correcaoMonetaria: 0,
                valorFinalCorrigido: 0, honorariosPercentual: 0, valorHonorarios: 0, valorTotalGeral: 0,
                inssReclamada: 0, baseCalculoInssReclamada: 0, percentualInssReclamada: parseFloat(inssPatronalPercent) || 0,
                isCalculationPossible: false, errorReason: err.message || "Erro de sistema",
                calculationSource: "",
            },
            timestamp: Date.now(),
            observation: calculationObservation,
        };
        setHistory(prevHistory => [newHistoryItem, ...prevHistory]);
        processedFileNames.push(file.name);
      }
    }
    
    if (quotaExceeded) {
        setStatus('error');
    } else if (failedCount > 0) {
        setError(`${failedCount} arquivo(s) apresentaram erros de liquidação técnica.`);
        setStatus('error');
    } else {
        setStatus('idle');
        alert('Liquidação concluída!');
    }
    
    setSelectedFiles(prevFiles => prevFiles.filter(file => !processedFileNames.includes(file.name)));
    setLoadingStatus('');
    setCalculationObservation('');
    setVacationPeriods([]);
    setThirteenthSalaryDetails('');
    setVestingDetails('');
  };

  const clearSelection = () => {
    setSelectedFiles([]);
    setStatus('idle');
    setResult(null);
    setError(null);
    setCalculationObservation('');
    setIsEditing(false); 
    setOriginalResultBeforeEdit(null);
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setIsEditing(false);
    setOriginalResultBeforeEdit(null);
    setResult(item.result);
    if (!item.result.isCalculationPossible) {
        setStatus('error');
        setError(item.result.errorReason);
    } else {
        setStatus('success');
        setError(null);
    }
    const dummyFile = new File([], item.fileName, { type: "application/pdf" }); 
    setSelectedFiles([dummyFile]);
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
      setOriginalResultBeforeEdit(null);
  };

  const handleSaveChanges = () => {
      if (result && currentHistoryItemId) {
          setHistory(prevHistory => {
              const newHistory = [...prevHistory];
              const itemIndex = newHistory.findIndex(item => item.id === currentHistoryItemId);
              if (itemIndex > -1) {
                  newHistory[itemIndex] = { ...newHistory[itemIndex], result: result };
              }
              return newHistory;
          });
      }
      setIsEditing(false);
      setOriginalResultBeforeEdit(null);
      alert('Liquidação atualizada no histórico!');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <History 
        history={history}
        onSelect={handleHistorySelect}
        onClear={() => setHistory([])}
        currentItemId={currentHistoryItemId}
        onExportExcel={() => exportHistoryToExcel(history)}
        onExportPdf={() => exportHistoryToPdf(history.map(item => item.result))}
      />
      <main className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto text-center mb-8">
            <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tighter">LIQUIDAÇÃO DA INICIAL</h1>
            <div className="h-1.5 w-24 bg-blue-600 mx-auto mt-4 rounded-full"></div>
        </div>
        
        {status === 'idle' && (
          <div className="w-full max-w-2xl flex flex-col items-center">
            <FileUpload 
              onFilesSelect={handleFilesSelect} 
              selectedFiles={selectedFiles} 
              removeFile={removeFileFromSelection}
            />

            {selectedFiles.length > 0 && (
                <div className="w-full mt-6 flex flex-col items-center space-y-4">
                    <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-3">
                            <label className="block text-sm font-bold text-gray-700 mb-1 text-left">Instruções Periciais de Cálculo</label>
                            <textarea
                                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm text-sm"
                                rows={3}
                                placeholder="Ex: 'Calcular HE com adicional de 100%', 'Considerar salário base de R$ 3.500', 'Individualizar reflexos'."
                                value={calculationObservation}
                                onChange={(e) => setCalculationObservation(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1 text-left">INSS Patronal (%)</label>
                            <input
                                type="number"
                                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm text-sm"
                                value={inssPatronalPercent}
                                onChange={(e) => setInssPatronalPercent(e.target.value)}
                                placeholder="Ex: 23"
                                min="0"
                                max="100"
                                step="0.1"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Cota Reclamada/Empresa</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                        <button 
                            onClick={handleStartBatchProcessing}
                            className="bg-blue-600 text-white font-bold px-10 py-3 rounded-lg hover:bg-blue-700 shadow-lg text-lg transition-transform active:scale-95"
                        >
                            Iniciar Liquidação Matemática
                        </button>
                        <button 
                            onClick={clearSelection}
                            className="bg-gray-400 text-white font-semibold px-6 py-2 rounded-lg hover:bg-gray-500 transition-colors"
                        >
                            Limpar
                        </button>
                    </div>
                </div>
            )}
          </div>
        )}
        
        {status === 'loading' && <Loader status={loadingStatus} />}
        
        {(status === 'error') && (
            <div className="w-full max-w-2xl text-center animate-fade-in">
                <div className="bg-white border-2 border-red-500 p-8 rounded-2xl shadow-2xl">
                    <div className="text-red-500 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Limite de Operação Excedido</h2>
                    <p className="text-gray-600 mb-6 bg-red-50 p-4 rounded-lg border border-red-100 italic">{error || "Não foi possível extrair os dados matemáticos devido a restrições de quota da API."}</p>
                    <div className="flex flex-col space-y-3">
                        <button onClick={clearSelection} className="bg-red-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-600 transition-all shadow-md">
                            Tentar Novamente agora
                        </button>
                        <p className="text-[10px] text-gray-400">Recomendação: Aguarde 60 segundos antes de reenviar para que o limite da API seja renovado.</p>
                    </div>
                </div>
            </div>
        )}

        {status === 'success' && result && (
            <div className="w-full">
                <div className="flex justify-center mb-6 space-x-3">
                    {!isEditing && (
                        <>
                             <button
                                onClick={handleStartEdit}
                                className="flex items-center space-x-2 bg-amber-500 text-white font-semibold px-6 py-2 rounded-lg hover:bg-amber-600 shadow-md"
                            >
                                <PencilIcon className="h-5 w-5" />
                                <span>Ajuste Pericial</span>
                            </button>
                            <button
                                onClick={() => createSingleCalculationPdf(result)}
                                className="flex items-center space-x-2 bg-emerald-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-emerald-700 shadow-md"
                            >
                                <DownloadIcon className="h-5 w-5" />
                                <span>Baixar PDF</span>
                            </button>
                            <button onClick={clearSelection} className="text-gray-500 font-semibold px-4 py-2 hover:bg-gray-100 rounded-lg">
                                Nova Liquidação
                            </button>
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

        <div className="mt-12 text-center text-gray-400 text-xs">
            <p>© 2025 Liquidação da Inicial • Todos os Direitos Reservados</p>
        </div>
      </main>
    </div>
  );
}

export default App;
