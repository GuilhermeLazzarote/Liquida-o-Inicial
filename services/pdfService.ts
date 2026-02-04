
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculoTrabalhista } from '../types';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('pt-BR', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
    }).format(value || 0);
};

export const createSingleCalculationPdf = (result: CalculoTrabalhista) => {
  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  generateReport(doc, result);
  const safeName = (result.reclamante || 'Calculo').toUpperCase().replace(/\s/g, '_').substring(0, 30);
  doc.save(`DEMONSTRATIVO_LIQUIDACAO_${safeName}.pdf`);
};

export const generateConsolidatedPdfFromHistory = (history: CalculoTrabalhista[]) => {
  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  history.forEach((result, index) => {
    if (index > 0) doc.addPage();
    generateReport(doc, result);
  });
  doc.save('CONSOLIDADO_LIQUIDACOES_JUDICIAIS.pdf');
};

const generateReport = (doc: jsPDF, result: CalculoTrabalhista) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    let currentY = 15;

    const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > pageHeight - margin) {
            doc.addPage();
            currentY = margin + 5;
            return true;
        }
        return false;
    };

    const today = new Date().toLocaleDateString('pt-BR');
    const dataRef = result.dataLiquidacao || today;

    // --- CABEÇALHO PERICIAL ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text('DEMONSTRATIVO DE LIQUIDAÇÃO DE SENTENÇA', margin, currentY);
    
    const infoX = pageWidth - 85;
    doc.setFontSize(8);
    doc.text(`Nº do Processo:`, infoX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(result.numeroProcesso || 'N/I', infoX + 22, currentY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Data de Emissão:`, infoX, currentY + 4);
    doc.text(today, infoX + 22, currentY + 4);

    currentY += 10;
    doc.setDrawColor(180);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 8;

    // --- IDENTIFICAÇÃO DAS PARTES ---
    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        body: [
            ['RECLAMANTE:', result.reclamante?.toUpperCase(), 'Início Cálc.:', result.periodoCalculoInicio || '-'],
            ['RECLAMADA:', result.reclamada?.toUpperCase(), 'Fim Cálc.:', result.periodoCalculoFim || '-'],
            ['AJUIZAMENTO:', result.dataAjuizamento || '-', 'Data Base:', dataRef]
        ],
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: 1 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 25 }, 1: { cellWidth: 135 }, 2: { fontStyle: 'bold', cellWidth: 25 } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // --- RESUMO DAS VERBAS ---
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('1. DEMONSTRATIVO DAS VERBAS APURADAS', margin, currentY);
    currentY += 4;

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['Rubrica Apurada', 'Nat.', 'Vl. Nominal', 'Princ. Corrigido', 'Juros (SELIC)', 'Total Bruto']],
        body: (result.verbas || []).map(v => [
            v.descricao.toUpperCase(),
            v.natureza === 'salarial' ? 'S' : 'I',
            formatCurrency(v.valor),
            formatCurrency(v.valorCorrigido),
            formatCurrency(v.juros),
            formatCurrency(v.total)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40], textColor: 255, fontSize: 8, halign: 'center', fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: { 
            0: { cellWidth: 'auto', minCellWidth: 70 }, 
            1: { halign: 'center', cellWidth: 10 }, 
            2: { halign: 'right', cellWidth: 32 }, 
            3: { halign: 'right', cellWidth: 32 }, 
            4: { halign: 'right', cellWidth: 32 }, 
            5: { halign: 'right', fontStyle: 'bold', cellWidth: 38 } 
        },
        foot: [['TOTAIS ACUMULADOS', '', '', formatCurrency(result.totalBruto), formatCurrency(result.juros), formatCurrency(result.valorFinalCorrigido)]],
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'right', fontSize: 8 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    // --- RESUMO FINANCEIRO ---
    checkPageBreak(65);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('2. QUADRO RESUMO DO DÉBITO ATUALIZADO', margin, currentY);
    currentY += 4;

    const colWidth = (pageWidth - (margin * 3)) / 2;
    
    autoTable(doc, {
        startY: currentY,
        margin: { left: margin },
        tableWidth: colWidth,
        head: [['CONTA DO RECLAMANTE', 'VALOR (R$)']],
        body: [
            ['(+) Principal Corrigido Bruto', formatCurrency(result.totalBruto)],
            ['(+) Juros de Mora (SELIC)', formatCurrency(result.juros)],
            ['(-) Previdência Social (Segurado)', `(${formatCurrency(result.inss)})`],
            ['(-) Imposto de Renda (IRRF)', `(${formatCurrency(result.irrf)})`],
            ['(+) FGTS Apurado', formatCurrency(result.fgts || 0)],
            ['VALOR LÍQUIDO DEVIDO AO RECLAMANTE', { content: formatCurrency(result.totalLiquido), styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }]
        ],
        theme: 'grid',
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 2.5 }
    });
    
    const finalYLeft = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin * 2 + colWidth },
        tableWidth: colWidth,
        head: [['ENCARGOS DA RECLAMADA', 'VALOR (R$)']],
        body: [
            ['Total da Condenação (Bruto)', formatCurrency(result.valorFinalCorrigido)],
            ['Honorários de Sucumbência', formatCurrency(result.valorHonorarios)],
            ['Cota Patronal (INSS)', formatCurrency(result.inssReclamada)],
            ['TOTAL GERAL DO DÉBITO', { content: formatCurrency(result.valorTotalGeral), styles: { fontStyle: 'bold', fillColor: [30, 30, 30], textColor: 255 } }]
        ],
        theme: 'grid',
        headStyles: { fillColor: [80, 80, 80], textColor: 255, fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 2.5 }
    });
    
    const finalYRight = (doc as any).lastAutoTable.finalY;
    currentY = Math.max(finalYLeft, finalYRight) + 12;

    // --- ANEXO DE MEMÓRIA ---
    doc.addPage();
    currentY = margin + 5;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ANEXO I - MEMÓRIA DE CÁLCULO MENSAL DISCRIMINADA', margin, currentY);
    currentY += 8;

    result.verbas.forEach((verba, vIdx) => {
        if (verba.detalhamentoMensal && verba.detalhamentoMensal.length > 0) {
            if (currentY > pageHeight - 50) {
                doc.addPage();
                currentY = margin + 5;
            }

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(`${vIdx + 1}.1 - ${verba.descricao.toUpperCase()}`, margin, currentY);
            currentY += 4;

            autoTable(doc, {
                startY: currentY,
                margin: { left: margin, right: margin },
                head: [['Comp.', 'Base Cálculo', 'Vl. Nominal', 'Índice', 'Princ. Corr.', 'Juros SELIC', 'Subtotal']],
                body: verba.detalhamentoMensal.map(m => [
                    m.competencia,
                    formatCurrency(m.baseCalculo),
                    formatCurrency(m.valorNominal),
                    formatNumber(m.indice || 1, 6),
                    formatCurrency(m.valorCorrigido),
                    formatCurrency(m.juros),
                    formatCurrency(m.total)
                ]),
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: 30, fontSize: 7, fontStyle: 'bold', halign: 'center' },
                styles: { fontSize: 6.5, cellPadding: 1, overflow: 'linebreak' },
                columnStyles: { 
                    0: { halign: 'center', cellWidth: 20 }, 
                    1: { halign: 'right', cellWidth: 35 }, 
                    2: { halign: 'right', cellWidth: 35 }, 
                    3: { halign: 'center', cellWidth: 35 }, 
                    4: { halign: 'right', cellWidth: 35, fontStyle: 'bold' }, 
                    5: { halign: 'right', cellWidth: 35 }, 
                    6: { halign: 'right', fontStyle: 'bold' } 
                },
                didDrawPage: (data) => {
                    currentY = data.cursor?.y || currentY;
                }
            });
            
            currentY = (doc as any).lastAutoTable.finalY + 12;
        }
    });
};
