
import { GoogleGenAI, Type } from "@google/genai";
import { CalculoTrabalhista } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result === null || result === undefined) {
        reject(new Error("Falha ao ler o arquivo."));
        return;
      }
      const resultString = typeof result === 'string' ? result : new TextDecoder().decode(result as ArrayBuffer);
      const parts = resultString.split(',');
      const base64Data = parts[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = (error) => reject(new Error(`Erro na leitura do arquivo: ${error}`));
    reader.readAsDataURL(file);
  });
}

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        reclamante: { type: Type.STRING },
        reclamada: { type: Type.STRING },
        numeroProcesso: { type: Type.STRING },
        dataAjuizamento: { type: Type.STRING },
        dataLiquidacao: { type: Type.STRING },
        periodoCalculoInicio: { type: Type.STRING },
        periodoCalculoFim: { type: Type.STRING },
        verbas: {
            type: Type.ARRAY,
            description: "LISTA EXAUSTIVA E SEQUENCIAL. Se o documento possui pedidos de 'a' até 'hh', você deve entregar todos os itens de 'a' até 'hh'.",
            items: {
                type: Type.OBJECT,
                properties: {
                    descricao: { type: Type.STRING, description: "Descrição completa do pedido (Ex: h) FGTS + 40%)." },
                    valor: { type: Type.NUMBER, description: "Valor Nominal Total da Rubrica." },
                    valorCorrigido: { type: Type.NUMBER },
                    juros: { type: Type.NUMBER },
                    total: { type: Type.NUMBER },
                    natureza: { type: Type.STRING, enum: ["salarial", "indenizatoria"] },
                    detalhamentoMensal: {
                        type: Type.ARRAY,
                        description: "OBRIGATÓRIO: Decomposição matemática de como se chegou ao valor total da rubrica.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                competencia: { type: Type.STRING, description: "MM/AAAA ou Referência do Cálculo." },
                                baseCalculo: { type: Type.NUMBER },
                                valorNominal: { type: Type.NUMBER, description: "Valor apurado na competência." },
                                indice: { type: Type.NUMBER },
                                valorCorrigido: { type: Type.NUMBER },
                                juros: { type: Type.NUMBER },
                                total: { type: Type.NUMBER }
                            },
                            required: ["competencia", "valorNominal", "total", "baseCalculo"]
                        }
                    }
                },
                required: ["descricao", "valor", "valorCorrigido", "juros", "total", "natureza", "detalhamentoMensal"],
            },
        },
        totalBruto: { type: Type.NUMBER },
        inss: { type: Type.NUMBER, description: "Cálculo técnico do INSS Segurado via tabela progressiva." },
        irrf: { type: Type.NUMBER, description: "Cálculo técnico do IRRF via sistemática RRA." },
        fgts: { type: Type.NUMBER },
        totalLiquido: { type: Type.NUMBER },
        juros: { type: Type.NUMBER },
        valorFinalCorrigido: { type: Type.NUMBER },
        honorariosPercentual: { type: Type.NUMBER },
        valorHonorarios: { type: Type.NUMBER },
        valorTotalGeral: { type: Type.NUMBER },
        inssReclamada: { type: Type.NUMBER },
        baseCalculoInssReclamada: { type: Type.NUMBER },
        percentualInssReclamada: { type: Type.NUMBER },
        isCalculationPossible: { type: Type.BOOLEAN },
        errorReason: { type: Type.STRING },
        observation: { type: Type.STRING }
    },
    required: ["reclamante", "reclamada", "numeroProcesso", "verbas", "totalBruto", "totalLiquido", "valorTotalGeral", "isCalculationPossible"]
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 15, initialDelay = 1500): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = error?.message || "";
      const isQuotaError = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
      if (isQuotaError && retries < maxRetries) {
        retries++;
        const delay = initialDelay * Math.pow(2, retries - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

export const processarCalculo = async (
  file: File,
  observation: string,
  vacationPeriods: any,
  thirteenthSalaryDetails: string,
  vestingDetails: string,
  inssPatronalPercent: string,
  modelName: 'gemini-3-pro-preview' | 'gemini-3-flash-preview' = 'gemini-3-flash-preview'
): Promise<CalculoTrabalhista> => {
    const today = new Date().toLocaleDateString('pt-BR');
    const prompt = `
    ### PROTOCOLO DE LIQUIDAÇÃO TÉCNICA JUDICIAL (FIXO)
    Você é um Perito Contador do Juízo. Sua análise deve ser exaustiva, precisa e baseada em prova documental.

    ### REGRAS PÉTREAS DE PROCESSAMENTO:
    1. **VARREDURA TOTAL (a até hh)**: O documento contém uma lista extensa de pedidos (Síntese dos Pedidos). Você é OBRIGADO a incluir CADA item dessa lista (da letra 'a' até a última alínea encontrada, como 'hh'). Pular itens é considerado erro pericial grave.
    2. **MEMÓRIA DE CÁLCULO MENSAL (COMPULSÓRIA)**: Para cada rubrica, o campo 'detalhamentoMensal' NÃO pode ser vazio. 
       - Se for verba rescisória: Demonstre o cálculo na competência do desligamento.
       - Se for verba mensal: Liste mês a mês no período do contrato.
       - Mostre a prova aritmética: Base x Quantidade x Adicionais.
    3. **PARÂMETROS DE VALOR**: Use preferencialmente os valores indicados na inicial como o 'Principal Nominal'. Se o item 'bb' diz 'R$ 1.814,40', este valor deve ser a base da sua liquidação para esse item.
    4. **TAXAS E IMPOSTOS**: 
       - INSS: Use tabela progressiva oficial.
       - IRRF: Sistemática RRA.
       - Atualização: SELIC conforme ADC 58 STF (Data Base: ${today}).

    DIRETRIZES DO PERITO: ${observation}
    INSS PATRONAL: ${inssPatronalPercent}%
    `;

    try {
        const filePart = await fileToGenerativePart(file);
        const responseText = await withRetry(async () => {
          const result = await ai.models.generateContent({
              model: modelName,
              contents: { parts: [{ text: prompt }, filePart] },
              config: {
                  responseMimeType: "application/json",
                  responseSchema: responseSchema,
                  thinkingConfig: { thinkingBudget: modelName.includes('pro') ? 32768 : 0 }
              }
          });
          return result.text;
        });
        return JSON.parse(responseText || "{}");
    } catch (error: any) {
        throw new Error(`Erro Crítico na Liquidação: ${error?.message || "O servidor de perícia não conseguiu decompor todos os itens. Tente novamente."}`);
    }
};
