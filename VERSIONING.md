# Versionamento & como testar ANTES de subir pro ar

Este guia explica como trabalhar no PristonZONE com segurança: testar cada
mudança num ambiente separado e só então publicar em produção.

---

## 1. As duas "áreas" do site

| Ambiente | Branch git | URL | Quem vê |
|---|---|---|---|
| **Produção** (no ar) | `main` | https://pristonzone.com | Todo mundo |
| **Teste / Preview** | qualquer outra branch (ex.: `dev`) | URL própria da Vercel | Só quem tem o link |

A Vercel está ligada ao GitHub. A regra é automática:

- Todo `git push` na branch **`main`** → **publica em produção** (o site no ar).
- Todo `git push` em **qualquer outra branch** (ex.: `dev`) → a Vercel cria uma
  **Preview Deployment**: uma cópia idêntica do site numa URL separada, que
  **NÃO afeta o site no ar**. É ali que a gente testa.

A URL de preview aparece:
- no painel da Vercel (Deployments → o mais recente da branch), e
- como um comentário/check no commit lá no GitHub.
- Formato típico: `https://priston-soul-tree-git-dev-devandrew98.vercel.app`

---

## 2. Testar na SUA máquina (antes até de dar push)

Rápido, sem internet, sem mexer em nada online:

```bash
npm run build     # compila e checa erros de tipo (tem que passar sem erro)
npm run preview   # sobe o site buildado em http://localhost:4173
npm test          # roda a suíte de testes do motor (27 testes)
```

> Nesta máquina o `npm run dev` (modo desenvolvimento) NÃO funciona por causa
> do acento em "André" no caminho da pasta — use sempre `npm run build` +
> `npm run preview`, que serve o site já buildado e funciona normalmente.

Se o `build` e os `testes` passarem, a mudança está saudável.

---

## 3. Fluxo do dia a dia (o jeito seguro)

```bash
# 1. Sempre comece atualizado com o que está no ar
git checkout main
git pull origin main

# 2. Crie/atualize a branch de testes a partir do main
git checkout -B dev            # -B cria OU reaproveita a branch 'dev'

# 3. Faça suas mudanças, teste local (build + preview + test)

# 4. Suba a branch de TESTE (NÃO é o site no ar)
git add -A
git commit -m "descricao da mudanca"   # (sem aspas duplas no texto — ver §6)
git push origin dev

# 5. Abra a URL de preview que a Vercel gerou e teste de verdade.

# 6. Gostou? Publica em produção:
git checkout main
git pull origin main
git merge dev
git push origin main          # AGORA sim vai pro ar
```

Não gostou do preview? É só continuar corrigindo na `dev` e dar push de novo —
o site no ar (`main`) segue intocado.

---

## 4. Marcar uma "versão" (opcional, mas recomendado)

Usamos **SemVer**: `MAIOR.MENOR.CORREÇÃO` (ex.: `1.4.2`).
- **CORREÇÃO** (patch): consertos, como o fix do Crios → `1.4.2` → `1.4.3`.
- **MENOR** (minor): recurso novo sem quebrar nada → `1.4.3` → `1.5.0`.
- **MAIOR** (major): mudança grande/incompatível → `1.5.0` → `2.0.0`.

Para carimbar um ponto estável (permite voltar pra ele depois):

```bash
git tag -a v1.4.0 -m "Crios corrigido + tetos de fusao"
git push origin v1.4.0
```

A versão também vive em `package.json` (`"version"`). Suba-a junto com o tag.

---

## 5. Voltar atrás (rollback) se algo quebrar no ar

- **Rápido (Vercel):** painel → Deployments → escolha o deploy bom anterior →
  **"Promote to Production"**. O site volta na hora, sem mexer no git.
- **No git (desfaz o commit ruim mantendo histórico):**
  ```bash
  git revert <hash-do-commit-ruim>
  git push origin main
  ```

---

## 6. Cuidados desta equipe (2 máquinas)

- **Duas máquinas empurram no mesmo `main`.** SEMPRE rode `git fetch origin` /
  `git pull --rebase origin main` antes de começar e antes de dar push, senão o
  push é rejeitado (`non-fast-forward`). Se rejeitar: `git pull --rebase origin main`
  e empurre de novo.
- **Commit no PowerShell (Windows):** NÃO use aspas duplas `"` no texto da
  mensagem — o PowerShell quebra o argumento e o commit falha. Escreva sem
  aspas (ou use aspas simples). Ex.: `Elite Crios Soul` em vez de `"Elite Crios Soul"`.

---

## 7. Padrão de comentários no código

Para qualquer pessoa pegar o código e entender rápido:

1. **Cabeçalho em todo arquivo** dizendo o QUE ele faz e como se encaixa
   (veja `src/lib/souls.ts` como modelo).
2. **Comente o PORQUÊ**, não o óbvio. `x++` não precisa de comentário;
   "greedy é míope, então rodamos numa escadinha de orçamentos" precisa.
3. **Marque as pegadinhas** com `// ⚠️` (regras do jogo, limites, decisões que
   parecem estranhas mas têm motivo).
4. **JSDoc (`/** ... */`) nas funções/tipos exportados** — some no editor de
   quem chamar a função.

> Onde ajustar dados do jogo: valores de soul em `src/data/souls.json`; layout
> da árvore (nodes, raridades, PvP atk/def) em `src/lib/tree.ts`; tetos de
> fusão (nível 201 / 217 pontos) em `src/lib/formula.ts`.
