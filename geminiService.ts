
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const extractTimecardData = async (imageBase64: string, retryCount = 0): Promise<ExtractionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  
  const systemInstruction = `Você é um perito em extração de dados (OCR) de alta precisão especializado em justiça do trabalho brasileira.
Seu objetivo é transformar imagens de folhas de ponto em dados estruturados para o sistema PJe-Calc.

REGRAS CRÍTICAS PARA MÚLTIPLOS MESES:
1. VARREDURA TOTAL: Se a página contiver dados de mais de um mês (ex: final de Janeiro e início de Fevereiro), você DEVE extrair todas as linhas sem exceção.
2. IDENTIFICAÇÃO DE PERÍODO: Procure no cabeçalho ou rodapé pelo período (ex: 21/01 a 20/02). Se o dia mudar de 31 para 01, certifique-se de que o campo 'date' reflita a mudança correta do mês.
3. DATAS INCOMPLETAS: Se houver apenas o dia (ex: "01", "02") na tabela, use a informação de mês/ano do cabeçalho para montar a data completa no formato DD/MM/AAAA.

REGRAS DE OURO PARA "NÃO PRATICOU LEITURA":
- Identifique carimbos ou textos como "NÃO PRATICOU A LEITURA", "NP" ou "NÃO PRATICOU".
- Se houver carimbo cobrindo vários dias, replique a observação para cada dia afetado.

REGRAS GERAIS:
- Datas: Formato DD/MM/AAAA.
- Horários: HH:MM (24h).
- Ocorrências: Registre sempre na coluna "obs" termos como "FALTA", "DSR", "FERIADO", "ATESTADO".

Retorne EXCLUSIVAMENTE um objeto JSON seguindo o schema.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extraia todos os dias deste cartão de ponto, garantindo que se houver mudança de mês na mesma folha, todas as datas sejam mapeadas corretamente para o respectivo mês e ano." },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64,
              },
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            entries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: "Data no formato DD/MM/AAAA" },
                  e1: { type: Type.STRING, description: "Primeira entrada" },
                  s1: { type: Type.STRING, description: "Primeira saída" },
                  e2: { type: Type.STRING, description: "Segunda entrada" },
                  s2: { type: Type.STRING, description: "Segunda saída" },
                  obs: { type: Type.STRING, description: "Ocorrências ou observações do dia" },
                },
                required: ["date", "e1", "s1", "e2", "s2"],
              },
            },
            summary: {
              type: Type.OBJECT,
              properties: {
                employeeName: { type: Type.STRING },
                period: { type: Type.STRING },
              },
            },
          },
          required: ["entries"],
        },
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("Resposta vazia da IA.");
    
    return JSON.parse(jsonStr.trim()) as ExtractionResult;
  } catch (e: any) {
    const isQuotaError = 
      e?.message?.includes("429") || 
      e?.status === 429 || 
      e?.message?.toLowerCase().includes("quota");

    if (isQuotaError && retryCount < 5) {
      const waitTime = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
      await sleep(waitTime);
      return extractTimecardData(imageBase64, retryCount + 1);
    }
    
    console.error("Erro na extração Gemini:", e);
    throw e;
  }
};
