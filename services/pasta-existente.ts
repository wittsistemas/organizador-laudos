import * as fs from "fs";

/**
 * Se já existe, dentro de `pai`, uma pasta equivalente (mesma chave), devolve o
 * nome dela. Assim "X LTDA" e "X LTDA ME" caem na mesma pasta de empresa, e
 * "CUBATAO" reaproveita a pasta "Cubatão".
 */
export function pastaExistente(
  pai: string,
  nome: string,
  chave: (n: string) => string,
): string {
  if (!fs.existsSync(pai)) return nome;
  const alvo = chave(nome);
  const achada = fs
    .readdirSync(pai, { withFileTypes: true })
    .find((d) => d.isDirectory() && chave(d.name) === alvo);
  return achada ? achada.name : nome;
}
