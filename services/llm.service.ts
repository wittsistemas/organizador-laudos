import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";

import "dotenv/config";

const ia = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "api_key" });
const modeloIA = process.env.MODELO_IA || "gemini-3.1-flash-lite";

export async function lerPDFComGemini(caminhoPdf: string) {
  try {
    if (!fs.existsSync(caminhoPdf)) {
      console.log(`Arquivo não encontrado: ${caminhoPdf}`);
      return fallback();
    }

    const pdfBuffer = fs.readFileSync(caminhoPdf);
    const pdfBase64 = pdfBuffer.toString("base64");

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
            "cidade": string
        }
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

    return {
      empresa: dados.empresa,
      uf: dados.uf,
      cidade: dados.cidade,
    };
  } catch (error) {
    console.error(`Erro ao processar PDF com Gemini:`, error);
    return fallback();
  }
}

function fallback() {
  return {
    empresa: null,
    uf: null,
    cidade: null,
  };
}
