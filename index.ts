import * as fs from "fs";

import { lerPDFComGemini } from "./services/llm.service.js";
import path from "path";

import "dotenv/config";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const caminhoLaudos = path.resolve(process.env.CAMINHO_LAUDOS || "/Laudos");

const pastaSaidaRaiz = path.resolve(process.env.PASTA_SAIDA || "/Downloads");

const PASTA_NAO_IDENTIFICADO = "NAO_IDENTIFICADO";

const resumo = {
  organizados: 0,
  naoIdentificados: [] as string[],
  falhas: [] as string[],
};

function limparNomePasta(texto: string | null): string {
  if (!texto) return PASTA_NAO_IDENTIFICADO;

  return texto
    .trim()
    .toUpperCase()
    .replace(/[/\\?%*:|"<>.]/g, "")
    .replace(/\s+/g, "_");
}

/** Devolve um caminho livre: se o arquivo já existe no destino, acrescenta _2, _3... */
function caminhoSemSobrescrever(pasta: string, nomeArquivo: string): string {
  const { name, ext } = path.parse(nomeArquivo);
  let candidato = path.join(pasta, nomeArquivo);
  let n = 2;
  while (fs.existsSync(candidato)) {
    candidato = path.join(pasta, `${name}_${n}${ext}`);
    n++;
  }
  return candidato;
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
      // Se a saída ficar dentro da pasta de entrada, não reprocessa o que já foi organizado.
      if (path.resolve(caminhoCompleto) === pastaSaidaRaiz) continue;

      console.log(`\nEntrando na pasta: ${caminhoCompleto}`);
      await buscarEProcessarArquivos(caminhoCompleto);
    } else if (item.isFile() && item.name.toLowerCase().endsWith(".pdf")) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Lendo arquivo: ${item.name}`);
      console.log(`Caminho: ${caminhoCompleto}`);

      try {
        console.log(`   🤖 Enviando PDF direto para o Gemini...`);
        const ia = await lerPDFComGemini(caminhoCompleto);

        // Falha da API: o arquivo fica onde está e entra de novo na próxima execução.
        if (!ia) {
          console.log(`   ⏭️  Falha na IA: arquivo mantido no lugar.`);
          resumo.falhas.push(caminhoCompleto);
          await sleep(5000);
          continue;
        }

        console.log("Dados extraídos:", ia);

        const uf = limparNomePasta(ia.uf);
        const cidade = limparNomePasta(ia.cidade);
        const empresa = limparNomePasta(ia.empresa);

        // A IA respondeu mas não identificou tudo: vai para NAO_IDENTIFICADO (revisão manual).
        const identificado = !!(ia.uf && ia.cidade && ia.empresa);
        const pastaDestino = identificado
          ? path.join(pastaSaidaRaiz, uf, cidade, empresa)
          : path.join(pastaSaidaRaiz, PASTA_NAO_IDENTIFICADO);

        fs.mkdirSync(pastaDestino, { recursive: true });

        const novoCaminhoArquivo = caminhoSemSobrescrever(pastaDestino, item.name);

        fs.copyFileSync(
          caminhoCompleto,
          novoCaminhoArquivo,
          fs.constants.COPYFILE_EXCL,
        );
        fs.unlinkSync(caminhoCompleto);

        if (identificado) {
          resumo.organizados++;
        } else {
          resumo.naoIdentificados.push(novoCaminhoArquivo);
        }

        console.log(
          `✅ Arquivo movido com sucesso para:\n   📍 ${novoCaminhoArquivo}`,
        );

        await sleep(Number(process.env.ESPERA_MS) || 5000);
      } catch (error) {
        resumo.falhas.push(caminhoCompleto);
        console.error("\nErro crítico:", error);
      }
    }
  }
}

async function organizarLaudos() {
  console.log(`Iniciando a varredura na pasta raiz: ${caminhoLaudos}`);
  await buscarEProcessarArquivos(caminhoLaudos);
  console.log(`\nVarredura e processamento concluídos!`);

  console.log("\n===== RESUMO =====");
  console.log(`Organizados:        ${resumo.organizados}`);
  console.log(`Não identificados:  ${resumo.naoIdentificados.length}`);
  resumo.naoIdentificados.forEach((c) => console.log(`   - ${c}`));
  console.log(`Falhas (repetir):   ${resumo.falhas.length}`);
  resumo.falhas.forEach((c) => console.log(`   - ${c}`));
}

organizarLaudos();
