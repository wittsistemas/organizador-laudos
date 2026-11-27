import * as fs from "fs";

import { lerPDFComGemini } from "./services/llm.service.js";
import path from "path";

import "dotenv/config";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const caminhoLaudos = process.env.CAMINHO_LAUDOS || "/Laudos";

const pastaSaidaRaiz = process.env.PASTA_SAIDA || "/Downloads";

function limparNomePasta(texto: string | null): string {
  if (!texto) return "NAO_IDENTIFICADO";

  return texto
    .trim()
    .toUpperCase()
    .replace(/[/\\?%*:|"<>.]/g, "")
    .replace(/\s+/g, "_");
}

async function buscarEProcessarArquivos(diretorioAtual: string) {
  let itens: fs.Dirent[] = [];

  try {
    itens = fs.readdirSync(diretorioAtual, { withFileTypes: true });
  } catch (erro) {
    console.error(`Erro ao ler o diretório ${diretorioAtual}:`, erro);
    return;
  }

  for (const item of itens) {
    const caminhoCompleto = path.join(diretorioAtual, item.name);

    if (item.isDirectory()) {
      console.log(`\nEntrando na pasta: ${caminhoCompleto}`);
      await buscarEProcessarArquivos(caminhoCompleto);
    } else if (item.isFile() && item.name.toLowerCase().endsWith(".pdf")) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Lendo arquivo: ${item.name}`);
      console.log(`Caminho: ${caminhoCompleto}`);

      try {
        console.log(`   🤖 Enviando PDF direto para o Gemini...`);
        const ia = await lerPDFComGemini(caminhoCompleto);

        console.log("Dados extraídos:", ia);

        const uf = limparNomePasta(ia.uf);
        const cidade = limparNomePasta(ia.cidade);
        const empresa = limparNomePasta(ia.empresa);

        const pastaDestino = path.join(pastaSaidaRaiz, uf, cidade, empresa);

        fs.mkdirSync(pastaDestino, { recursive: true });

        const novoCaminhoArquivo = path.join(pastaDestino, item.name);

        fs.copyFileSync(caminhoCompleto, novoCaminhoArquivo);
        fs.unlinkSync(caminhoCompleto);

        console.log(
          `✅ Arquivo movido com sucesso para:\n   📍 ${novoCaminhoArquivo}`,
        );

        await sleep(10000);
      } catch (error) {
        console.error("\nErro crítico:", error);
      }
    }
  }
}

async function organizarLaudos() {
  console.log(`Iniciando a varredura na pasta raiz: ${caminhoLaudos}`);
  await buscarEProcessarArquivos(caminhoLaudos);
  console.log(`\nVarredura e processamento concluídos!`);
}

organizarLaudos();
