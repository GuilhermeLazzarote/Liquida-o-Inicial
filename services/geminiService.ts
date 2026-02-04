
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
            items: {
                type: Type.OBJECT,
                properties: {
                    descricao: { type: Type.STRING, description: "Nome técnico da rubrica (ex: Horas Extras 50%, Adicional de Insalubridade, etc)" },
                    valor: { type: Type.NUMBER, description: "Soma dos valores nominais calculados aritmeticamente por você." },
                    valorCorrigido: { type: Type.NUMBER, description: "Principal corrigido monetariamente pelo índice do mês." },
                    juros: { type: Type.NUMBER, description: "Juros SELIC acumulados conforme ADC 58." },
                    total: { type: Type.NUMBER, description: "Soma de principal corrigido + juros" },
                    natureza: { type: Type.STRING, enum: ["salarial", "indenizatoria"] },
                    detalhamentoMensal: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                competencia: { type: Type.STRING, description: "MM/AAAA" },
                                baseCalculo: { type: Type.NUMBER, description: "Salário base identificado no documento para este mês específico." },
                                valorNominal: { type: Type.NUMBER, description: "CÁLCULO OBRIGATÓRIO: Execute a fórmula (Base * Adicional * Proporção). É terminantemente proibido apenas copiar o valor da petição." },
                                indice: { type: Type.NUMBER, description: "Índice de correção monetária (ex: 1.002345)" },
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
        inss: { type: Type.NUMBER },
        irrf: { type: Type.NUMBER },
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
    ### PERSONA: PERITO CONTADOR JUDICIAL (ESPECIALISTA EM PJE-CALC)
    Você deve atuar como perito nomeado, realizando a LIQUIDAÇÃO TÉCNICA dos pedidos.

    ### MANDAMENTOS DE LIQUIDAÇÃO (PROIBIÇÃO DE TRANSCRIÇÃO):
    1. **Obrigação de Cálculo**: Você não deve "extrair" valores prontos. Você deve "calcular" os valores. Identifique a base salarial, o divisor, o multiplicador (ex: 1.5 para HE 50%) e a quantidade.
    2. **Memória Mensal Exaustiva**: Toda rubrica deve ter seu detalhamento mensal MM/AAAA. Se o pedido for "Diferenças Salariais de Jan/2022 a Dez/2022", você deve gerar 12 linhas de detalhamento.
    3. **Atualização Monetária**: Utilize a data de referência ${today}. Aplique SELIC conforme tese firmada pelo STF (ADC 58).
    4. **Natureza das Verbas**: Diferencie rigorosamente verbas salariais de indenizatórias para fins de cálculo de INSS Cota Empregado e Patronal.

    ### PARÂMETROS ADICIONAIS:
    Instruções do usuário: ${observation}
    INSS Patronal configurado: ${inssPatronalPercent}%
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
        throw new Error(`Falha na Liquidação: ${error?.message || "Erro no servidor de cálculos"}`);
    }
};
