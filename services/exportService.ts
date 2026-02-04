
import { CalculoTrabalhista, HistoryItem } from '../types';
import { generateConsolidatedPdfFromHistory } from './pdfService';

// For using the global XLSX variable from the CDN script
declare const XLSX: any;

export const exportSingleCalculationToExcel = (data: CalculoTrabalhista, fileName: string) => {
  const wb = XLSX.utils.book_new();
  const currencyFormat = '"R$" #,##0.00';
  
  const summaryWs = XLSX.utils.aoa_to_sheet([]);
  
  summaryWs['!pageSetup'] = { 
      paperSize: 9, // A4
      orientation: 'landscape',
      scale: 100,
      fitToPage: true,
      fitToWidth: 1
  };

  summaryWs['!cols'] = [
      { wch: 50 }, // A: Descrição
      { wch: 18 }, // B: Principal
      { wch: 18 }, // C: Juros
      { wch: 18 }  // D: Total
  ];

  let currentRow = 0;

  XLSX.utils.sheet_add_aoa(summaryWs, [['DEMONSTRATIVO DE LIQUIDAÇÃO JUDICIAL - PLANILHA ANALÍTICA']], { origin: { r: currentRow, c: 0 } });
  currentRow += 2;

  XLSX.utils.sheet_add_aoa(summaryWs, [['DADOS DA APURAÇÃO']], { origin: { r: currentRow, c: 0 } });
  currentRow += 1;
  XLSX.utils.sheet_add_aoa(summaryWs, [
      ['Número do Processo:', data.numeroProcesso],
      ['Reclamante:', data.reclamante],
      ['Reclamada:', data.reclamada],
      ['Período de Apuração:', `${data.periodoCalculoInicio} a ${data.periodoCalculoFim}`]
  ], { origin: { r: currentRow, c: 0 } });
  currentRow += 5;

  XLSX.utils.sheet_add_aoa(summaryWs, [['DEMONSTRATIVO DE VERBAS LIQUIDADAS']], { origin: { r: currentRow, c: 0 } });
  currentRow += 1;
  XLSX.utils.sheet_add_aoa(summaryWs, [['Rubrica', 'Principal Corrigido', 'Juros de Mora', 'Total Bruto']], { origin: { r: currentRow, c: 0 } });
  currentRow += 1;

  data.verbas.forEach(v => {
      XLSX.utils.sheet_add_aoa(summaryWs, [[
          v.descricao.toUpperCase(),
          v.valorCorrigido,
          v.juros,
          v.total
      ]], { origin: { r: currentRow, c: 0 } });
      currentRow++;
  });

  currentRow += 2;

  XLSX.utils.sheet_add_aoa(summaryWs, [['QUADRO RESUMO DE VALORES']], { origin: { r: currentRow, c: 0 } });
  currentRow += 1;
  XLSX.utils.sheet_add_aoa(summaryWs, [
      ['BRUTO DEVIDO (PRINCIPAL + JUROS)', data.valorFinalCorrigido],
      ['(-) INSS COTA EMPREGADO', data.inss],
      ['(-) IRRF RETIDO NA FONTE', data.irrf],
      ['(+) FGTS (CRÉDITO AO RECLAMANTE)', data.fgts || 0],
      ['VALOR LÍQUIDO DEVIDO AO RECLAMANTE', data.totalLiquido],
      ['HONORÁRIOS DE SUCUMBÊNCIA', data.valorHonorarios],
      ['COTA PATRONAL PREVIDENCIÁRIA', data.inssReclamada],
      ['TOTAL GERAL DO DÉBITO (CUSTO DA RECLAMADA)', data.valorTotalGeral]
  ], { origin: { r: currentRow, c: 0 } });

  const range = XLSX.utils.decode_range(summaryWs['!ref']);
  for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = 1; C <= 3; ++C) {
          const cellRef = XLSX.utils.encode_cell({c: C, r: R});
          if (summaryWs[cellRef] && typeof summaryWs[cellRef].v === 'number') {
             summaryWs[cellRef].z = currencyFormat;
          }
      }
  }

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumo da Liquidação');
  XLSX.writeFile(wb, `Liquidacao_${fileName}.xlsx`);
};

export const exportHistoryToExcel = (history: HistoryItem[]) => {
    const wb = XLSX.utils.book_new();
    const currencyFormat = '"R$" #,##0.00';

    const summaryWs = XLSX.utils.aoa_to_sheet([['Histórico Consolidado de Liquidações Judiciais']]);
    const header = ['Data de Apuração', 'Arquivo Origem', 'Nº Processo', 'Total Geral do Débito'];
    XLSX.utils.sheet_add_aoa(summaryWs, [[]], { origin: -1 });
    XLSX.utils.sheet_add_aoa(summaryWs, [header], { origin: -1 });

    const rows = history.map(item => [
        new Date(item.timestamp).toLocaleString('pt-BR'),
        item.fileName,
        item.result.numeroProcesso,
        item.result.valorTotalGeral
    ]);
    XLSX.utils.sheet_add_aoa(summaryWs, rows, { origin: -1 });

    summaryWs['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 20 }];
     const range = XLSX.utils.decode_range(summaryWs['!ref']);
    for (let R = 3; R <= range.e.r; ++R) {
         const cellRef = XLSX.utils.encode_cell({c: 3, r: R});
         if (summaryWs[cellRef]) summaryWs[cellRef].z = currencyFormat;
    }

    XLSX.utils.book_append_sheet(wb, summaryWs, 'Histórico');
    XLSX.writeFile(wb, 'Historico_Consolidado_Liquidacoes.xlsx');
};

export const exportHistoryToPdf = (historyResults: CalculoTrabalhista[]) => {
    generateConsolidatedPdfFromHistory(historyResults);
};
