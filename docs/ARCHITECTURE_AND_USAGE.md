# MangaX — Manga Tracker & Reader — Documentação de Arquitetura e Uso

Inspirado no projeto **FRANK Scanlation** de Fabio Akita ([akitaonrails/frank_scanlation](https://github.com/akitaonrails/frank_scanlation)).

---

## 1. Visão Geral da Arquitetura

O sistema foi desenvolvido seguindo estrita separação de responsabilidades em camadas desacopladas:

1. **Camada de Persistência (SQLite / `sql.js`):**
   - Banco de dados relacional SQLite com migrações versionadas (`schema_migrations`), integridade referencial com chaves estrangeiras (`PRAGMA foreign_keys = ON`), transações e índices dedicados (`idx_chapters_manga_num`, `idx_chapters_unread`, `idx_sources_manga`, etc.).
   - Arquivo persistido em `data/frank_manga.sqlite`.

2. **Motores de Fontes Extensíveis (`src/server/sources/`):**
   - Interface comum `MangaSource` definindo: `canHandle(url)`, `extractManga(url)`, `extractChapters(urlOrId)`, `extractPages(chapterId)`, `search(query)`.
   - **MangaDex API (`MangaDexSource`):** Integração completa com a API oficial do MangaDex (`https://api.mangadex.org`) para pesquisa, extração de capas, metadados, feeds de capítulos em múltiplos idiomas e URLs de alta resolução via servidores MangaDex@Home.
   - **Web Scraper Universal HTML (`GenericHtmlSource`):** Extrator baseado em Cheerio com detecção de OpenGraph, seletores semânticos e analisadores de expressões regulares para identificação de números decimais (ex: 10.5), especiais e capítulos extras.
   - **Arquivo Offline / Amostras Locais (`SampleMangaSource`):** Garante testes determinísticos e leitura contínua mesmo sem conexão externa.

3. **Agendador de Monitoramento (`src/server/services/monitoring.ts`):**
   - Execução autônoma em segundo plano com intervalo configurável (padrão 30 minutos).
   - Controle de concorrência com processamento em lotes (evita sobrecarga nos servidores das fontes).
   - Detecção precisa de novos capítulos por comparação normalizada contra o histórico armazenado em SQLite.
   - Prevenção ativa de duplicações.
   - Registro detalhado de telemetria em `check_logs` (duração em ms, capítulos encontrados, novos lançamentos, falhas transitórias).
   - Geração de notificações persistentes.

4. **Proteção contra Anúncios e Sanitização (`src/server/services/security.ts`):**
   - Proxy seguro de imagens e controle de navegação:
     - Bloqueio de domínios predatórios de publicidade, pop-ups e redirecionamento malicioso (ex: popcash, popads, monetag, adsterra, exoclick, outbrain).
     - Remoção de referrers invasivos e proteção contra rastreadores de terceiros.
     - Registro de eventos bloqueados para diagnóstico do usuário.

5. **Integrated Reader (`src/components/Reader.tsx`):**
   - 4 Modos de leitura intercambiáveis: **Single** (página única), **Double** (páginas duplas), **Book** (spreads com ordem tradicional de mangá da direita para a esquerda - RTL), **Webtoon** (rolagem vertical com scroll snap).
   - Atalhos de teclado oficiais mapeados:
     - `Space`: Avançar página ou spread
     - `ArrowLeft` / `ArrowRight`: Navegação entre páginas
     - `D`: Alternar Single → Double → Book
     - `N`: Alternar filtro noturno (Desativado → Noturno suave → Sépia → Invertido de alto contraste)
     - `S`: Ativar ou desativar scroll snap
     - `Enter`: Próximo capítulo
     - `Backspace`: Capítulo anterior
     - `?`: Modal de ajuda dos atalhos
     - `Esc`: Fechar Reader
   - Detecção de conflitos de digitação (ignora atalhos quando o usuário digita em inputs).
   - Atualização automática da última página lida e marcação de conclusão do capítulo.

---

## 2. Instruções de Instalação, Compilação e Execução

### Pré-requisitos
- Node.js versão 20+ ou 22+.
- Gerenciador de pacotes `npm`.

### Instalação de Dependências
```bash
npm install
```

### Execução em Modo de Desenvolvimento
O aplicativo inicia o servidor Express integrado ao Vite na porta 3000:
```bash
npm run dev
```
Acesse: `http://localhost:3000`

### Execução dos Testes Automatizados
```bash
npx tsx tests/suite.test.ts
```

### Compilação de Produção
```bash
npm run build
```
Os artefatos compilados e otimizados serão gerados no diretório `dist/`.

---

## 3. Como Adicionar Novas Fontes

Para adicionar um novo site de scanlation ou fonte de mangá:
1. Crie um arquivo em `src/server/sources/<nome-da-fonte>.ts`.
2. Implemente a interface `MangaSource`:
   ```typescript
   import { MangaSource, MangaMetadata, ChapterMetadata, ChapterPagesResult } from './types';

   export class MinhaNovaFonte implements MangaSource {
     id = 'minha-fonte';
     name = 'Nome da Fonte';
     baseUrl = 'https://meusite.com';

     canHandle(url: string): boolean {
       return url.includes('meusite.com');
     }

     async extractManga(url: string): Promise<MangaMetadata> { ... }
     async extractChapters(urlOrExternalId: string): Promise<ChapterMetadata[]> { ... }
     async extractPages(chapterUrlOrId: string): Promise<ChapterPagesResult> { ... }
   }
   ```
3. Registre a nova classe na lista de fontes em `src/server/sources/index.ts`. O agendador e o leitor passarão a utilizá-la automaticamente.

---

## 4. Limitações Conhecidas e Suposições do Ambiente

1. **Ambiente Web vs Tauri 2 Desktop:**
   - No ambiente em nuvem do Google AI Studio (Linux sem display server X11/Wayland e sem compilação Rust/WebKitGTK local), a aplicação foi arquitetada como uma aplicação Full-Stack Node/TypeScript/Express + SQLite + React/Vite.
   - Todas as regras de negócio, persistência, atalhos, leitor e agendador funcionam 100% no navegador.
   - Para empacotar em Tauri 2 em sua máquina local, basta apontar a configuração `tauri.conf.json` para o frontend Vite (`dist/` ou `http://localhost:3000`) e mapear os comandos para as rotas da API já estruturadas.
2. **Fontes protegidas por Cloudflare Turnstile / Captcha:**
   - Sites que utilizam proteção contra robôs com desafio Cloudflare interativo exigem integração com solvers de captcha ou headers de sessão. Para essas fontes, utilize fontes com APIs abertas como o MangaDex ou adicione a fonte via cadastro manual/fontes alternativas.
