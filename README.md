# wa-gnome

Wrapper desktop do WhatsApp Web para Ubuntu/GNOME, feito para manter o WhatsApp
rodando (e notificando) com a janela fechada, sem depender do Google Chrome.

Stack: Electron 45 (Chromium 156, Node 24) · TypeScript 7 (strict) · electron-vite 6 / Vite 8 · Vitest.

## Status

| Fase | Escopo | Estado |
|------|--------|--------|
| 1 | Estrutura, janela, sessão persistente | ✅ implementada |
| 2 | Bandeja, fechar → ocultar, Sair | pendente |
| 3 | Notificações com a janela oculta | pendente (investigação inicial abaixo) |
| 4 | Autostart (`~/.config/autostart`) | pendente |
| 5 | Logs em arquivo, AppImage/.deb | pendente |

## Desenvolvimento

```bash
npm install
npm run dev        # electron-vite com hot reload do main/preload
npm run build      # gera out/
npm start          # roda o build atual
npm run typecheck  # tsc -b (strict)
npm test           # vitest
npm run check      # typecheck + test + build
```

`WA_GNOME_DEBUG=1 npm start` ativa logs de debug e o menu padrão do Electron
(Ctrl+Shift+I abre o DevTools).

> **VS Code:** o terminal integrado exporta `ELECTRON_RUN_AS_NODE=1`, o que faz
> o Electron rodar como Node puro (`Cannot find module 'electron'`). Os scripts
> `dev`/`start` removem essa variável com `env -u`. Se for chamar
> `npx electron` direto, faça o mesmo.

## Arquitetura

```text
src/
├── shared/constants.ts    URL, origem e partição de sessão
├── main/
│   ├── index.ts           bootstrap: instância única, sessão, janela
│   ├── lifecycle.ts       instância única, flush da sessão no quit, flag "quitting"
│   ├── session.ts         partição persist:whatsapp + política de permissões
│   ├── window.ts          WindowManager: criar/mostrar/ocultar, navegação, recuperação
│   ├── context-menu.ts    menu de contexto de edição + corretor ortográfico
│   ├── policy.ts          regras puras (URLs, permissões) — testadas
│   └── logger.ts
└── preload/index.ts       sandbox + contextIsolation; não expõe nada ainda
```

Não há `src/renderer/`: a interface é o próprio `https://web.whatsapp.com/`.

### Segurança
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.
- Só a origem `https://web.whatsapp.com` é carregada na janela. Links e
  `window.open` vão para o navegador padrão (apenas `http(s)`, `mailto`, `tel`).
  Redirecionamentos para fora e `<webview>` são bloqueados.
- Permissões são negadas por padrão. A origem do WhatsApp recebe só
  `notifications`, `media` (microfone/câmera), `clipboard-sanitized-write` e `fullscreen`.
- User-Agent padrão do Electron. O WhatsApp Web aceita esse UA sem modificação (validado).

### Sessão
Partição `persist:whatsapp` em `~/.config/wa-gnome/Partitions/whatsapp`
(cookies, IndexedDB com as chaves do dispositivo, Service Worker). Os dados
são gravados no disco com `flushStorageData()` antes de sair. Uma única
instância é permitida: dois processos no mesmo perfil podem corromper o LevelDB.

## Notas técnicas (investigação)

- **Push API não funciona no Electron**: `pushManager.subscribe()` retorna
  `AbortError: Registration failed - push service not available`. O Electron
  não traz o serviço de push (FCM) do Chrome. Por isso, a estratégia para
  notificações em segundo plano é manter o renderer vivo com
  `backgroundThrottling: false`: o WebSocket do WhatsApp continua conectado e
  a página continua chamando `new Notification()`. A Fase 3 valida isso com
  mensagens reais.
- **Wayland**: o Electron 45 usa Wayland nativo por padrão (`ozone wayland`).
  Os avisos de `vaInitialize`/Vulkan no terminal são ruído do Chromium e não
  afetam o app. Se aparecer algum problema gráfico, use
  `env -u ELECTRON_RUN_AS_NODE npx electron . --ozone-platform=x11` (após
  `npm run build`) para comparar.
- **Bandeja no GNOME**: o GNOME puro não exibe ícones de bandeja. O Tray do
  Electron usa StatusNotifierItem/AppIndicator, e o ícone só aparece com a
  extensão *Ubuntu AppIndicators* (`ubuntu-appindicators@ubuntu.com`, ativa por
  padrão no Ubuntu) ou com *AppIndicator and KStatusNotifierItem Support* em
  outras distribuições.
