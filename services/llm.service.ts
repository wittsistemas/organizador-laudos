import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

import "dotenv/config";

const ia = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "api_key" });
const modeloIA = process.env.MODELO_IA || "gemini-3.1-flash-lite";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const UFS_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export type Identificacao = {
  empresa: string | null;
  uf: string | null;
  cidade: string | null;
};

/**
 * Devolve a identificação do laudo, ou null quando a chamada FALHOU (API fora
 * do ar, limite estourado, arquivo ausente, resposta inválida).
 * Quando a IA responde mas não acha algo, o campo vem null dentro do objeto.
 * Falha não pode virar "não identificado": o arquivo deve ficar onde está.
 */
export async function lerPDFComGemini(
  caminhoPdf: string,
): Promise<Identificacao | null> {
  if (!fs.existsSync(caminhoPdf)) {
    console.log(`Arquivo não encontrado: ${caminhoPdf}`);
    return null;
  }

  const pdfBase64 = fs.readFileSync(caminhoPdf).toString("base64");

  const MAX_TENTATIVAS = 3;
  let espera = 15000;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const response = await ia.models.generateContent({
        model: modeloIA,
        contents: [
          {
            inlineData: {
              data: pdfBase64,
              mimeType: "application/pdf",
            },
          },
          {
            text: `Analise o documento PDF anexado e busque a UF, CIDADE e nome da EMPRESA avaliada no laudo.

        Extraia os dados solicitados retornando ESTRITAMENTE em formato JSON.

        Retorne ESTRITAMENTE um objeto JSON com essa estrutura exata:
        {
            "empresa": "string",
            "uf": "string com duas letras (sigla do estado)",
            "cidade": "string"
        }
        Se não encontrar algum dado, use null nele.
        `,
          },
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.0,
        },
      });

      const textoResposta = response.text;
      if (!textoResposta) throw new Error("Resposta vazia da API do Gemini");

      const dados = JSON.parse(textoResposta.trim());

      const uf = String(dados.uf ?? "").trim().toUpperCase();

      return {
        empresa: dados.empresa ? String(dados.empresa) : null,
        uf: UFS_VALIDAS.has(uf) ? uf : null,
        cidade: dados.cidade ? String(dados.cidade) : null,
      };
    } catch (error: any) {
      // 503 (servidor ocupado) e 429 (limite por minuto) são temporários: tenta de novo.
      const temporario = error?.status === 503 || error?.status === 429;
      if (temporario && tentativa < MAX_TENTATIVAS) {
        console.log(
          `   ⚠️ Erro ${error.status} na API. Tentativa ${tentativa} de ${MAX_TENTATIVAS}. Aguardando ${espera / 1000}s...`,
        );
        await sleep(espera);
        espera *= 2;
        continue;
      }
      console.error(`Erro ao processar PDF com Gemini:`, error?.message ?? error);
      return null;
    }
  }

  return null;
}
