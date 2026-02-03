
export interface DetalhamentoMensal {
  competencia: string;
  baseCalculo: number;
  quantidade?: number;
  unidade?: string;
  indice?: number;
  valorNominal: number;
  valorCorrigido: number;
  juros: number;
  total: number;
}

export interface Verba {
  descricao: string;
  valor: number; 
  valorCorrigido: number; 
  juros: number; 
  total: number; 
  natureza: 'salarial' | 'indenizatoria';
  detalhamentoMensal?: DetalhamentoMensal[];
}

export interface JurosCorrecaoDetalhe {
  periodo: string;
  indice: string;
  valorCorrecao: number;
  valorJuros: number;
}

export interface CalculoTrabalhista {
  reclamante: string;
  reclamada: string;
  numeroProcesso: string;
  dataAjuizamento?: string;
  dataLiquidacao?: string;
  periodoCalculoInicio?: string;
  periodoCalculoFim?: string;
  verbas: Verba[];
  totalBruto: number;
  inss: number;
  irrf: number;
  fgts?: number;
  totalLiquido: number;
  juros: number;
  correcaoMonetaria: number;
  detalhesJurosCorrecao?: JurosCorrecaoDetalhe[];
  valorFinalCorrigido: number;
  honorariosPercentual: number;
  valorHonorarios: number;
  valorTotalGeral: number;
  observation?: string;
  inssReclamada: number;
  baseCalculoInssReclamada: number;
  percentualInssReclamada: number;
  isCalculationPossible: boolean;
  errorReason: string;
  calculationSource: "AI_CALCULATED" | "CLAIMANT_PROVIDED_BASIS" | "";
}

export interface HistoryItem {
  id: string;
  fileName: string;
  result: CalculoTrabalhista;
  timestamp: number;
  observation?: string;
}
