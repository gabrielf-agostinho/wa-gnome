# wa-gnome

Wrapper desktop do WhatsApp Web para Ubuntu/GNOME, feito para manter o WhatsApp
rodando (e notificando) com a janela fechada, sem depender do Google Chrome.

Stack: Electron 45 (Chromium 156, Node 24) · TypeScript 7 (strict) · electron-vite 6 / Vite 8 · Vitest.

## Status

| Fase | Escopo | Estado |
|------|--------|--------|
| 1 | Estrutura, janela, sessão persistente | ✅ implementada |
| 2 | Bandeja, fechar → ocultar, Sair | ✅ implementada |
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
│   ├── index.ts           bootstrap: instância única, sessão, janela, bandeja
│   ├── lifecycle.ts       instância única, flush da sessão no quit, flag "quitting"
│   ├── session.ts         partição persist:whatsapp + política de permissões
│   ├── window.ts          WindowManager: criar/mostrar/ocultar, X → ocultar, navegação, recuperação
│   ├── tray.ts            TrayManager: ícone, menu, contador de não lidas
│   ├── tray-support.ts    detecta host StatusNotifierItem no D-Bus
│   ├── unread.ts          contador de não lidas a partir do título "(N) WhatsApp"
│   ├── user-agent.ts      remove o token "wa-gnome/x.y.z" do UA
│   ├── context-menu.ts    menu de contexto de edição + corretor ortográfico
│   ├── policy.ts          regras puras (URLs, permissões) — testadas
│   └── logger.ts
└── preload/index.ts       sandbox + contextIsolation; não expõe nada ainda
```

Não há `src/renderer/`: a interface é o próprio `https://web.whatsapp.com/`.

Ícones em `resources/icons/` são arte original (não o logo do WhatsApp),
gerados por `python3 scripts/generate-icons.py` (requer Pillow).

### Janela e bandeja
- **X** oculta a janela; o processo, a conexão e as notificações continuam.
- **Encerrar de verdade:** menu da bandeja → *Sair*, ou **Ctrl+Q** na janela.
- **Clique no ícone** da bandeja: abre e foca a janela.
- **Menu:** contador de conversas não lidas · Abrir WhatsApp · Ocultar janela ·
  Iniciar com o sistema (desabilitado até a Fase 4) · Sair.
- O ícone ganha um ponto vermelho quando há conversas não lidas. A contagem é
  lida do título público da página (`(3) WhatsApp`), sem acessar nada interno
  do WhatsApp.
- **Abrir o app de novo** pelo menu de aplicativos ou pelo terminal também
  restaura a janela (instância única).
- **Sem bandeja**, ou seja, sem o host SNI (verificado no D-Bus): ao fechar
  pela primeira vez, o app mostra uma notificação explicando que continua em
  execução e como reabri-lo.

### Segurança
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.
- Só a origem `https://web.whatsapp.com` é carregada na janela. Links e
  `window.open` vão para o navegador padrão (apenas `http(s)`, `mailto`, `tel`).
  Redirecionamentos para fora e `<webview>` são bloqueados.
- Permissões são negadas por padrão. A origem do WhatsApp recebe só
  `notifications`, `media` (microfone/câmera), `clipboard-sanitized-write` e `fullscreen`.
- User-Agent: o do próprio Electron, sem fingir ser o Google Chrome. Única
  alteração: removemos o token `wa-gnome/<versão>`, que o Electron insere
  quando o app tem nome próprio. Com esse token, o WhatsApp mostra "O WhatsApp
  funciona no Google Chrome 100 ou posterior" em vez do QR Code (reproduzido
  com o Electron 45.3.3). Veja `src/main/user-agent.ts`.

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
  outras distribuições. O item publicado pelo Electron 45 tem `ItemIsMenu=false`
  (o clique esquerdo dispara `Activate`, que abre a janela) e o menu é exportado
  via `com.canonical.dbusmenu`. Os dois comportamentos foram validados chamando
  o D-Bus diretamente.
- **Wayland e foco**: o GNOME pode recusar dar foco a uma janela restaurada
  (prevenção de roubo de foco) e mostrar "WhatsApp está pronto" em vez de
  trazê-la para frente. Se isso acontecer ao clicar no ícone da bandeja, é essa
  política do compositor.
