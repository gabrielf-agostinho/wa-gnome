# wa-gnome

Wrapper desktop do WhatsApp Web para Ubuntu/GNOME, feito para manter o WhatsApp
rodando (e notificando) com a janela fechada, sem depender do Google Chrome.

Stack: Electron 45 (Chromium 156, Node 24) · TypeScript 7 (strict) · electron-vite 6 / Vite 8 · Vitest.

## Status

| Fase | Escopo | Estado |
|------|--------|--------|
| 1 | Estrutura, janela, sessão persistente | ✅ implementada |
| 2 | Bandeja, fechar → ocultar, Sair | ✅ implementada |
| 3 | Notificações com a janela oculta | ✅ implementada (falta validar com mensagem real) |
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
├── shared/
│   ├── constants.ts       URL, origem, partição de sessão, desktop ID
│   └── ipc.ts             canais IPC preload → main
├── main/
│   ├── index.ts           bootstrap: instância única, sessão, janela, bandeja
│   ├── background.ts      switches do Chromium p/ execução em 2º plano, desktop ID
│   ├── notifications.ts   NotificationManager: clique → restaurar janela, contagem
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
└── preload/
    ├── index.ts               sandbox + contextIsolation; instala o observador
    └── notification-observer.ts  observa show/click da Notification padrão
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

## Notificações

### Como funciona
1. O WhatsApp Web chama `new Notification()` na própria página.
2. O Chromium exibe a notificação via libnotify, no serviço
   `org.freedesktop.Notifications` do GNOME Shell, com
   `desktop-entry: io.github.wagnome.WaGnome`.
3. A página continua viva com a janela oculta, porque o X oculta em vez de
   fechar. Ela também continua com timers em velocidade normal, graças às
   flags do Chromium em `src/main/background.ts`.
4. Ao clicar na notificação, o observador instalado pelo preload avisa o
   processo principal, que restaura a janela. O handler do próprio WhatsApp
   roda normalmente e abre a conversa.

### O que foi verificado (Electron 45.3.3, GNOME 50, Wayland)

| Item | Resultado |
|------|-----------|
| Push API (`pushManager.subscribe`) | ❌ `AbortError: push service not available`, porque o Electron não traz o FCM do Chrome |
| `ServiceWorkerRegistration.showNotification` | ❌ nenhuma chamada `Notify` no D-Bus e a promise nunca resolve, porque o Electron não implementa notificações persistentes |
| `new Notification()` com a janela oculta | ✅ chega no D-Bus (`Notify`) e o evento `show` dispara |
| Mesma `tag` | ✅ substitui a anterior (mesmo `replaces_id`), sem duplicata |
| Página oculta por 6,5 min | ✅ `visibilityState: hidden`, timers de 1 s com intervalo máximo de 1005 ms, notificação entregue |
| Clique → janela | ✅ restaura a janela, e o `onclick` da página continua rodando |
| `window.focus()` da página | ❌ não mostra a janela oculta, por isso existe o observador |

**Escolha do modo de segundo plano** (medido com a janela oculta por 6,5 min):

| Configuração | Visibilidade | Intervalo máx. entre timers de 1 s |
|---|---|---|
| `backgroundThrottling: false` | `visible` | 1004 ms |
| `backgroundThrottling: true` | `hidden` | **59 s** (*intensive wake-up throttling*) |
| `true` + `--disable-background-timer-throttling` + `--disable-features=IntensiveWakeUpThrottling` | `hidden` | 1005 ms |

`visible` com a janela oculta é ruim: o WhatsApp pode tratar a conversa aberta
como lida, enviando confirmação de leitura indevida. A terceira linha dá o mesmo
estado de uma aba do Chrome em segundo plano, mas sem limitar os timers.

### Limitações
- **O processo precisa estar rodando.** Sem Web Push no Electron, não há
  notificação depois de *Sair*, antes do login no sistema (a Fase 4 resolve com
  autostart) ou durante a suspensão. Ao acordar, o WhatsApp reconecta e entrega
  as pendentes.
- **Sem Push, não há alternativa oficial** para receber notificações com o
  processo encerrado: o WhatsApp não oferece uma API pública para isso.
  Alternativas viáveis: manter o app em execução (escolhida) ou usar o app
  oficial do WhatsApp para Linux, se um dia existir.
- **Foco no Wayland:** depois do clique na notificação, o GNOME pode mostrar
  "está pronto" em vez de trazer a janela para frente.
- O texto das mensagens nunca passa pelo processo principal nem pelos logs.
  Só é registrado "notification delivered (#n)".

## Notas técnicas

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
