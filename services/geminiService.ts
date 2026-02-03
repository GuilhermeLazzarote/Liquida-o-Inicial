
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
                    descricao: { type: Type.STRING, description: "Nome da verba e reflexos individualizados conforme pedidos da inicial" },
                    valor: { type: Type.NUMBER },
                    valorCorrigido: { type: Type.NUMBER },
                    juros: { type: Type.NUMBER },
                    total: { type: Type.NUMBER },
                    natureza: { type: Type.STRING, enum: ["salarial", "indenizatoria"] },
                    detalhamentoMensal: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                competencia: { type: Type.STRING, description: "MM/AAAA" },
                                baseCalculo: { type: Type.NUMBER },
                                quantidade: { type: Type.NUMBER },
                                unidade: { type: Type.STRING },
                                valorNominal: { type: Type.NUMBER },
                                indice: { type: Type.NUMBER, description: "Índice de correção monetária aplicado para o mês" },
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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 5000): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = error?.message || "";
      const isQuotaError = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota');
      
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
  inssPatronalPercent: string
): Promise<CalculoTrabalhista> => {
    
    const today = new Date().toLocaleDateString('pt-BR');
    
    const prompt = `
    ### PERSONA: PERITO CONTADOR JUDICIAL (ESPECIALISTA EM PJE-CALC)
    Sua missão é realizar a liquidação de sentença/inicial com rigor pericial absoluto.

    ### REQUISITO DE DATA ATUAL (CRÍTICO):
    - A DATA DE LIQUIDAÇÃO/ATUALIZAÇÃO É HOJE: ${today}.
    - Todos os cálculos de correção monetária e juros (SELIC) devem ser projetados e atualizados exatamente até esta data.
    - O campo 'dataLiquidacao' no JSON deve ser obrigatoriamente '${today}'.

    ### REQUISITOS OBRIGATÓRIOS DE TEMPORALIDADE E ABRANGÊNCIA:
    1. **LIQUIDAÇÃO EXAUSTIVA DE PEDIDOS**:
       - Analise o documento e liquide TODOS os pedidos (verbas) identificados na inicial ou sentença. Não omita nenhuma rubrica.
    2. **LISTAGEM MENSAL EXAUSTIVA**:
       - O array 'detalhamentoMensal' DEVE conter TODOS os meses individuais sem exceção até o final da apuração.
       - PROIBIDO agrupar ou omitir meses.

    ### CRITÉRIOS TÉCNICOS:
    - JUROS E CORREÇÃO: Utilize EXCLUSIVAMENTE a taxa SELIC acumulada (ADC 58 STF).
    - Verbas Salariais: Incidência de INSS, IRRF e FGTS.

    ### FORMATO DE SAÍDA:
    - Retorne APENAS JSON válido conforme o esquema.
    - No campo 'observation', confirme que todos os pedidos foram liquidados e atualizados até ${today}.

    Instruções Adicionais: ${observation}
    INSS Patronal: ${inssPatronalPercent}%
    `;

    try {
        const filePart = await fileToGenerativePart(file);
        
        const responseText = await withRetry(async () => {
          const result = await ai.models.generateContent({
              model: "gemini-3-pro-preview",
              contents: { parts: [{ text: prompt }, filePart] },
              config: {
                  responseMimeType: "application/json",
                  responseSchema: responseSchema,
                  thinkingConfig: { thinkingBudget: 32768 }
              }
          });
          return result.text;
        });
        
        return JSON.parse(responseText || "{}");
    } catch (error: any) {
        const errorMsg = error?.message || "";
        if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
          throw new Error("LIMITE_QUOTA: O servidor de IA está com alta demanda. Tente em instantes.");
        }
        throw new Error(`Erro na liquidação pericial: ${errorMsg}`);
    }
};
