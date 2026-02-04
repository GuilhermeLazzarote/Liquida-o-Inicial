
import React, { useState, useEffect } from 'react';
import { CalculoTrabalhista, Verba, DetalhamentoMensal } from '../types';
import { TrashIcon, PlusIcon, MinusIcon, PencilIcon } from './icons';

interface ResultsDisplayProps {
  result: CalculoTrabalhista;
  isEditing?: boolean;
  onResultChange?: (newResult: CalculoTrabalhista) => void;
  onSave?: () => void;
  onCancel?: () => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('pt-BR', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
    }).format(value || 0);
};

const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
);

const ChevronUpIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
);

const EditableInput: React.FC<{value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; className?: string; placeholder?: string}> = ({ value, onChange, type = 'text', className = '', placeholder = '' }) => (
    <input
        type={type}
        value={value}
        onChange={onChange}
        step="0.000001"
        placeholder={placeholder}
        className={`w-full p-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 bg-white text-sm font-mono transition-shadow ${className}`}
    />
);

const NumericSpinner: React.FC<{
  value: number;
  onChange: (val: number) => void;
  className?: string;
  size?: 'sm' | 'md';
  step?: number;
}> = ({ value, onChange, className = '', size = 'md', step = 0.01 }) => {
  const increment = (amount: number) => {
    onChange(Number((value + amount).toFixed(6)));
  };

  const btnClass = size === 'sm' ? "p-1" : "p-1.5";
  const iconClass = size === 'sm' ? "h-2.5 w-2.5" : "h-3.5 w-3.5";

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <button 
        type="button"
        onClick={() => increment(-step)}
        className={`${btnClass} bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded text-gray-400 border border-gray-200 transition-all active:scale-90`}
      >
        <MinusIcon className={iconClass} />
      </button>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full min-w-[80px] ${size === 'sm' ? 'p-1 text-[11px]' : 'p-1.5 text-xs'} border border-gray-300 rounded text-right font-mono focus:ring-1 focus:ring-blue-500 bg-white shadow-sm`}
      />
      <button 
        type="button"
        onClick={() => increment(step)}
        className={`${btnClass} bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded text-gray-400 border border-gray-200 transition-all active:scale-90`}
      >
        <PlusIcon className={iconClass} />
      </button>
    </div>
  );
};

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ result, isEditing = false, onResultChange, onSave, onCancel }) => {
  const [expandedVerbas, setExpandedVerbas] = useState<number[]>([]);

  const toggleExpand = (index: number) => {
    setExpandedVerbas(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  useEffect(() => {
    if (!isEditing || !onResultChange) return;

    const updatedVerbas: Verba[] = result.verbas.map(v => {
      if (v.detalhamentoMensal && v.detalhamentoMensal.length > 0) {
        const sumNominal = v.detalhamentoMensal.reduce((s, m) => s + (Number(m.valorNominal) || 0), 0);
        const sumCorrigido = v.detalhamentoMensal.reduce((s, m) => s + (Number(m.valorCorrigido) || 0), 0);
        const sumJuros = v.detalhamentoMensal.reduce((s, m) => s + (Number(m.juros) || 0), 0);
        const sumTotal = sumCorrigido + sumJuros;

        return {
          ...v,
          valor: sumNominal,
          valorCorrigido: sumCorrigido,
          juros: sumJuros,
          total: sumTotal
        };
      }
      return {
        ...v,
        total: (Number(v.valorCorrigido) || 0) + (Number(v.juros) || 0)
      };
    });

    const sumValorCorrigido = updatedVerbas.reduce((sum, v) => sum + (Number(v.valorCorrigido) || 0), 0);
    const sumJuros = updatedVerbas.reduce((sum, v) => sum + (Number(v.juros) || 0), 0);
    const sumTotalVerbas = sumValorCorrigido + sumJuros;

    const baseInssPatronal = updatedVerbas
      .filter(v => v.natureza === 'salarial')
      .reduce((sum, v) => sum + (Number(v.valorCorrigido) || 0), 0);
    
    const inssReclamada = baseInssPatronal * ((Number(result.percentualInssReclamada) || 0) / 100);
    const valorHonorarios = sumTotalVerbas * ((Number(result.honorariosPercentual) || 0) / 100);
    const totalLiquido = sumTotalVerbas - (Number(result.inss) || 0) - (Number(result.irrf) || 0) + (Number(result.fgts) || 0);
    const valorTotalGeral = sumTotalVerbas + valorHonorarios + inssReclamada;

    const hasChanged = 
        JSON.stringify(result.verbas) !== JSON.stringify(updatedVerbas) ||
        result.totalBruto !== sumValorCorrigido ||
        result.juros !== sumJuros ||
        result.valorFinalCorrigido !== sumTotalVerbas ||
        result.inssReclamada !== inssReclamada ||
        result.valorTotalGeral !== valorTotalGeral ||
        result.totalLiquido !== totalLiquido ||
        result.valorHonorarios !== valorHonorarios;

    if (hasChanged) {
        onResultChange({
            ...result,
            verbas: updatedVerbas,
            totalBruto: sumValorCorrigido,
            juros: sumJuros,
            valorFinalCorrigido: sumTotalVerbas,
            totalLiquido: totalLiquido,
            valorHonorarios: valorHonorarios,
            inssReclamada: inssReclamada,
            baseCalculoInssReclamada: baseInssPatronal,
            valorTotalGeral: valorTotalGeral
        });
    }
  }, [
    result.verbas, 
    result.inss, 
    result.irrf, 
    result.fgts,
    result.honorariosPercentual, 
    result.percentualInssReclamada, 
    isEditing, 
    onResultChange
  ]);

  const handleFieldChange = (field: keyof CalculoTrabalhista, value: any) => {
    if (onResultChange) onResultChange({ ...result, [field]: value });
  };

  const handleVerbaFieldChange = (index: number, field: keyof Verba, value: any) => {
    if (onResultChange) {
      const newVerbas = [...result.verbas];
      newVerbas[index] = { ...newVerbas[index], [field]: value };
      onResultChange({ ...result, verbas: newVerbas });
    }
  };

  const handleMonthlyDetailChange = (verbaIdx: number, monthlyIdx: number, field: keyof DetalhamentoMensal, value: any) => {
    if (onResultChange) {
      const newVerbas = [...result.verbas];
      const newMonthly = [...(newVerbas[verbaIdx].detalhamentoMensal || [])];
      const updatedItem = { ...newMonthly[monthlyIdx], [field]: value };
      
      if (field === 'valorNominal' || field === 'indice') {
          const nominal = field === 'valorNominal' ? value : (updatedItem.valorNominal || 0);
          const indice = field === 'indice' ? value : (updatedItem.indice || 1);
          updatedItem.valorCorrigido = Number((nominal * (indice || 1)).toFixed(2));
      }

      updatedItem.total = Number(((Number(updatedItem.valorCorrigido) || 0) + (Number(updatedItem.juros) || 0)).toFixed(2));
      
      newMonthly[monthlyIdx] = updatedItem;
      newVerbas[verbaIdx] = { ...newVerbas[verbaIdx], detalhamentoMensal: newMonthly };
      onResultChange({ ...result, verbas: newVerbas });
    }
  };

  return (
    <div className="w-full max-w-7xl bg-white p-6 rounded-xl shadow-xl border border-gray-200 animate-fade-in mb-8">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">DEMONSTRATIVO DE LIQUIDAÇÃO TÉCNICA</h2>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-tighter">Cálculo Pericial de Haveres Judiciais</p>
        </div>
        <div className="text-right">
            <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100 block mb-1">
                Laudo Pericial Consolidado
            </span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Referência: {result.dataLiquidacao || new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <InfoItem label="Número do Processo" value={result.numeroProcesso} isEditing={isEditing} onChange={(e) => handleFieldChange('numeroProcesso', e.target.value)} />
        <InfoItem label="Reclamante" value={result.reclamante} isEditing={isEditing} onChange={(e) => handleFieldChange('reclamante', e.target.value)} />
        <InfoItem label="Reclamada" value={result.reclamada} isEditing={isEditing} onChange={(e) => handleFieldChange('reclamada', e.target.value)} />
      </div>

      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-700 flex items-center">
                <span className="bg-blue-600 w-1.5 h-6 mr-2 rounded-full"></span>
                1. Verbas Apuradas e Reflexos
            </h3>
            {isEditing && (
                <button 
                    onClick={() => onResultChange?.({ ...result, verbas: [...result.verbas, { descricao: 'Nova Rubrica', valor: 0, valorCorrigido: 0, juros: 0, total: 0, natureza: 'salarial', detalhamentoMensal: [] }] })}
                    className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-emerald-700 transition-all flex items-center active:scale-95"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Adicionar Rubrica
                </button>
            )}
        </div>
        
        <div className="border rounded-xl shadow-sm overflow-hidden bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest">Rubrica</th>
                <th className="px-3 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-widest w-20">Nat.</th>
                <th className="px-3 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-widest w-36">Princ. Corrig.</th>
                <th className="px-3 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-widest w-36">Juros Mora</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-600 uppercase tracking-widest w-40">Total Bruto</th>
                <th className="px-4 py-3 w-28 text-center text-[11px] font-bold text-gray-400 uppercase tracking-widest">Detalhes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {result.verbas.map((v, idx) => (
                <React.Fragment key={idx}>
                  <tr className={`transition-all ${expandedVerbas.includes(idx) ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3.5 text-sm flex items-center">
                       <button 
                        onClick={() => toggleExpand(idx)}
                        className={`mr-3 p-1 rounded-md transition-all ${expandedVerbas.includes(idx) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                       >
                         {expandedVerbas.includes(idx) ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                       </button>
                       <div className="flex-grow">
                        {isEditing ? <EditableInput value={v.descricao} onChange={(e) => handleVerbaFieldChange(idx, 'descricao', e.target.value)} /> : <span className="font-semibold text-gray-700">{v.descricao}</span>}
                       </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${v.natureza === 'salarial' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {v.natureza === 'salarial' ? 'Sal' : 'Ind'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-mono text-gray-600">
                      {formatCurrency(v.valorCorrigido)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-mono text-gray-600">
                      {formatCurrency(v.juros)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-black font-mono text-gray-900 bg-gray-50/50">
                      {formatCurrency(v.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                       <div className="flex items-center justify-center space-x-2">
                        {isEditing ? (
                          <button onClick={() => { if(window.confirm('Excluir rubrica?')) onResultChange?.({ ...result, verbas: result.verbas.filter((_, i) => i !== idx) }) }} className="text-gray-300 hover:text-red-500 p-1.5 transition-colors">
                            <TrashIcon className="h-4.5 w-4.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded shadow-sm text-gray-400 font-bold uppercase">{v.detalhamentoMensal?.length || 0} Meses</span>
                        )}
                       </div>
                    </td>
                  </tr>
                  
                  {expandedVerbas.includes(idx) && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50/80 px-2 sm:px-6 py-6 border-l-[6px] border-blue-500">
                        <div className="flex items-center justify-between mb-4 px-2">
                          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            Memória de Cálculo Discriminada
                          </h4>
                          {isEditing && (
                            <button onClick={() => {
                                 const newVerbas = [...result.verbas];
                                 const currentDetail = newVerbas[idx].detalhamentoMensal || [];
                                 newVerbas[idx].detalhamentoMensal = [...currentDetail, { competencia: '', baseCalculo: 0, valorNominal: 0, valorCorrigido: 0, juros: 0, total: 0, quantidade: 0, unidade: '', indice: 1 }];
                                 onResultChange?.({...result, verbas: newVerbas});
                               }} className="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95">
                                 + Novo Mês
                            </button>
                          )}
                        </div>
                        
                        <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-x-auto">
                          <table className="min-w-[1000px] w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                              <tr className="divide-x divide-slate-100">
                                <th className="px-2 py-2.5 text-left text-[9px] font-bold text-slate-500 uppercase">Competência</th>
                                <th className="px-2 py-2.5 text-right text-[9px] font-bold text-slate-500 uppercase">Base de Cálculo</th>
                                <th className="px-2 py-2.5 text-right text-[9px] font-bold text-slate-500 uppercase">Valor Nominal</th>
                                <th className="px-2 py-2.5 text-center text-[9px] font-bold text-slate-500 uppercase w-24">Índice Corr.</th>
                                <th className="px-2 py-2.5 text-right text-[9px] font-bold text-slate-500 uppercase">Principal Corrig.</th>
                                <th className="px-2 py-2.5 text-right text-[9px] font-bold text-slate-500 uppercase">Juros SELIC</th>
                                <th className="px-3 py-2.5 text-right text-[9px] font-bold text-blue-600 uppercase">Subtotal</th>
                                {isEditing && <th className="px-2 py-2.5 w-10"></th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">
                              {v.detalhamentoMensal?.map((m, midx) => (
                                <tr key={midx} className="hover:bg-blue-50/10 divide-x divide-slate-50">
                                  <td className="px-2 py-2 text-xs">
                                    {isEditing ? <EditableInput value={m.competencia} placeholder="MM/AAAA" onChange={(e) => handleMonthlyDetailChange(idx, midx, 'competencia', e.target.value)} className="p-1 text-[10px] h-7 text-center" /> : <span className="font-bold text-slate-700">{m.competencia}</span>}
                                  </td>
                                  <td className="px-2 py-2 text-right text-xs">
                                    {isEditing ? <NumericSpinner size="sm" value={m.baseCalculo} onChange={(val) => handleMonthlyDetailChange(idx, midx, 'baseCalculo', val)} /> : <span className="font-mono text-[11px]">{formatCurrency(m.baseCalculo)}</span>}
                                  </td>
                                  <td className="px-2 py-2 text-right text-xs">
                                    {isEditing ? <NumericSpinner size="sm" value={m.valorNominal} onChange={(val) => handleMonthlyDetailChange(idx, midx, 'valorNominal', val)} /> : <span className="font-mono text-[11px]">{formatCurrency(m.valorNominal)}</span>}
                                  </td>
                                  <td className="px-2 py-2 text-center text-xs">
                                    {isEditing ? <NumericSpinner size="sm" step={0.000001} value={m.indice || 1} onChange={(val) => handleMonthlyDetailChange(idx, midx, 'indice', val)} /> : <span className="font-mono text-[10px] text-gray-500">{formatNumber(m.indice || 1, 6)}</span>}
                                  </td>
                                  <td className="px-2 py-2 text-right text-xs">
                                    {isEditing ? <NumericSpinner size="sm" value={m.valorCorrigido} onChange={(val) => handleMonthlyDetailChange(idx, midx, 'valorCorrigido', val)} /> : <span className="font-mono text-[11px] text-gray-700 font-semibold">{formatCurrency(m.valorCorrigido)}</span>}
                                  </td>
                                  <td className="px-2 py-2 text-right text-xs">
                                    {isEditing ? <NumericSpinner size="sm" value={m.juros} onChange={(val) => handleMonthlyDetailChange(idx, midx, 'juros', val)} /> : <span className="font-mono text-[11px]">{formatCurrency(m.juros)}</span>}
                                  </td>
                                  <td className="px-3 py-2 text-right text-xs font-black font-mono text-slate-800 bg-slate-50/30">
                                    {formatCurrency(m.total)}
                                  </td>
                                  {isEditing && (
                                    <td className="px-2 py-2 text-center">
                                      <button onClick={() => { const newVerbas = [...result.verbas]; newVerbas[idx].detalhamentoMensal = newVerbas[idx].detalhamentoMensal?.filter((_, i) => i !== midx); onResultChange?.({...result, verbas: newVerbas}); }} className="text-slate-300 hover:text-red-500 transition-colors">
                                        <TrashIcon className="h-4 w-4" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
        <div>
            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                <span className="bg-blue-600 w-1.5 h-6 mr-2 rounded-full"></span>
                2. Fundamentação e Notas Periciais
            </h3>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner">
                {isEditing ? (
                    <textarea 
                        value={result.observation} 
                        onChange={(e) => handleFieldChange('observation', e.target.value)}
                        className="w-full p-4 border border-slate-300 rounded-xl text-sm min-h-[220px] focus:ring-1 focus:ring-blue-500 bg-white"
                        placeholder="Descreva critérios de juros, índices e bases de cálculo..."
                    />
                ) : (
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap italic">
                        {result.observation || 'Relatório pericial sem observações adicionais.'}
                    </div>
                )}
            </div>
        </div>

        <div>
            <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center">
                <span className="bg-blue-600 w-1.5 h-6 mr-2 rounded-full"></span>
                3. Resumo Financeiro da Liquidação
            </h3>
            <div className="bg-gray-900 p-8 rounded-2xl text-white shadow-2xl relative overflow-hidden">
                <SummaryRow label="Principal Corrigido Bruto" value={formatCurrency(result.totalBruto)} />
                <SummaryRow label="Juros de Mora (SELIC)" value={formatCurrency(result.juros)} />
                
                <div className="my-5 space-y-3 py-5 border-y border-gray-800">
                    <SummaryRow 
                        label="(-) INSS Cota Segurado" 
                        value={isEditing ? result.inss : `- ${formatCurrency(result.inss)}`} 
                        isEditing={isEditing} 
                        onChange={(val) => handleFieldChange('inss', val)} 
                        color="text-rose-400" 
                    />
                    <SummaryRow 
                        label="(-) IRRF Retenção Fonte" 
                        value={isEditing ? result.irrf : `- ${formatCurrency(result.irrf)}`} 
                        isEditing={isEditing} 
                        onChange={(val) => handleFieldChange('irrf', val)} 
                        color="text-rose-400" 
                    />
                    <SummaryRow 
                        label="(+) FGTS Apurado" 
                        value={isEditing ? result.fgts || 0 : formatCurrency(result.fgts || 0)} 
                        isEditing={isEditing} 
                        onChange={(val) => handleFieldChange('fgts', val)} 
                        color="text-sky-300" 
                    />
                </div>
                
                <div className="mb-6 flex justify-between items-end">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-tighter">Líquido Devido ao Reclamante</span>
                    <span className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">{formatCurrency(result.totalLiquido)}</span>
                </div>

                <div className="pt-5 border-t border-gray-800 space-y-3">
                    <SummaryRow label="Honorários Sucumbenciais (%)" value={result.honorariosPercentual} isEditing={isEditing} onChange={(val) => handleFieldChange('honorariosPercentual', val)} />
                    <SummaryRow label="INSS Patronal (Reclamada) (%)" value={result.percentualInssReclamada} isEditing={isEditing} onChange={(val) => handleFieldChange('percentualInssReclamada', val)} />
                </div>

                <div className="mt-8 p-5 bg-gradient-to-r from-gray-800 to-gray-800/50 rounded-xl flex justify-between items-center border border-gray-700 shadow-inner">
                    <div>
                        <span className="text-[10px] font-black uppercase text-gray-500 block tracking-widest">Custo Total da Reclamada</span>
                    </div>
                    <span className="text-3xl font-black text-white font-mono tracking-tighter">{formatCurrency(result.valorTotalGeral)}</span>
                </div>
            </div>
        </div>
      </div>

      {isEditing && (
        <div className="flex justify-center mt-14 space-x-6">
          <button 
            onClick={onSave} 
            className="bg-blue-600 text-white font-black uppercase tracking-tighter px-14 py-4 rounded-xl hover:bg-blue-700 transition-all shadow-xl active:scale-95 flex items-center text-lg"
          >
            Salvar Liquidação
          </button>
          <button 
            onClick={onCancel} 
            className="bg-slate-100 text-slate-500 font-bold uppercase tracking-tighter px-10 py-4 rounded-xl hover:bg-slate-200 transition-all text-sm"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

const InfoItem: React.FC<{ label: string, value: string, isEditing?: boolean, onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, value, isEditing, onChange }) => (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 transition-colors hover:border-blue-200">
        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{label}</p>
        {isEditing && onChange ? (
            <input value={value || ''} onChange={onChange} className="w-full p-1 border-b-2 border-blue-400 bg-transparent font-bold text-slate-800 text-sm focus:outline-none transition-all focus:border-blue-600" />
        ) : (
            <p className="text-sm font-black text-slate-800 truncate">{value || '---'}</p>
        )}
    </div>
);

const SummaryRow: React.FC<{ label: string, value: any, isEditing?: boolean, onChange?: (val: number) => void, color?: string, bold?: boolean, size?: string }> = ({ label, value, isEditing, onChange, color = "text-gray-200", bold = false, size = "text-sm" }) => (
    <div className="flex justify-between items-center py-1">
        <span className={`text-[11px] font-black text-gray-500 uppercase tracking-tighter`}>{label}</span>
        {isEditing && onChange ? (
            <div className="flex items-center">
                <NumericSpinner value={value} onChange={onChange} className="w-40" />
            </div>
        ) : (
            <span className={`${size} font-mono ${bold ? 'font-black' : 'font-semibold'} ${color} tracking-tighter`}>{value}</span>
        )}
    </div>
);

export default ResultsDisplay;
