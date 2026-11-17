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
| 4 | Autostart (`~/.config/autostart`), configurações, lançador | ✅ implementada |
| 5 | Logs em arquivo, erros, AppImage/.deb | ✅ implementada (falta instalar o .deb) |

## Desenvolvimento

```bash
npm install
npm run dev        # electron-vite com hot reload do main/preload
npm run build      # gera out/
npm start          # roda o build atual
npm run typecheck  # tsc -b (strict)
npm test           # vitest
npm run check      # typecheck + test + build
npm run desktop:install    # instala o lançador + ícones em ~/.local/
npm run desktop:uninstall  # remove
npm run dist               # check + AppImage e .deb em dist/
npm run dist:appimage      # só AppImage (também: dist:deb, dist:dir)
```

Flags de linha de comando: `--hidden` inicia só na bandeja (usado pelo
autostart), `--install-desktop-entry` e `--uninstall-desktop-entry`.

Logs: `~/.local/state/wa-gnome/wa-gnome.log` (ver [Logs e erros](#logs-e-erros)).
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
│   ├── autostart.ts       AutostartManager: ~/.config/autostart/<id>.desktop (+ inotify)
│   ├── settings.ts        SettingsStore: settings.json tipado, escrita atômica
│   ├── desktop-integration.ts  lançador + ícones hicolor em ~/.local/share
│   ├── desktop-entry.ts   gerar/ler .desktop (quoting do Exec conforme a spec)
│   ├── launch.ts          comando que inicia esta instalação (dev, AppImage, .deb)
│   ├── cli.ts / xdg.ts    flags de linha de comando, diretórios XDG
│   ├── lifecycle.ts       instância única, flush da sessão no quit, log de crashes
│   ├── session.ts         partição persist:whatsapp + política de permissões
│   ├── window.ts          WindowManager: criar/mostrar/ocultar, X → ocultar, navegação, recuperação
│   ├── tray.ts            TrayManager: ícone, menu, contador de não lidas
│   ├── tray-support.ts    detecta host StatusNotifierItem no D-Bus
│   ├── unread.ts          contador de não lidas a partir do título "(N) WhatsApp"
│   ├── user-agent.ts      remove o token "wa-gnome/x.y.z" do UA
│   ├── context-menu.ts    menu de contexto de edição + corretor ortográfico
│   ├── policy.ts          regras puras (URLs, permissões) — testadas
│   └── logger.ts          console + arquivo com rotação (~/.local/state/wa-gnome)
└── preload/
    ├── index.ts               sandbox + contextIsolation; instala o observador
    └── notification-observer.ts  observa show/click da Notification padrão
```

Não há `src/renderer/`: a interface é o próprio `https://web.whatsapp.com/`.

Ícones em `resources/icons/` são arte original (não o logo do WhatsApp),
gerados por `python3 scripts/generate-icons.py` (requer Pillow).
Empacotamento: [electron-builder.yml](electron-builder.yml) e
[scripts/after-pack.cjs](scripts/after-pack.cjs).

### Janela e bandeja
- **X** oculta a janela; o processo, a conexão e as notificações continuam.
- **Encerrar de verdade:** menu da bandeja → *Sair*, ou **Ctrl+Q** na janela.
- **Clique no ícone** da bandeja: abre e foca a janela.
- **Menu:** contador de conversas não lidas · Abrir WhatsApp · Ocultar janela ·
  Iniciar com o sistema · Sair.
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

## Inicialização automática e configurações

- **Iniciar com o sistema** (menu da bandeja) cria ou remove
  `~/.config/autostart/io.github.wagnome.WaGnome.desktop`, seguindo a spec XDG
  Autostart que o GNOME implementa.
- **O estado vem do próprio arquivo.** Se você desativar pelo GNOME Tweaks
  (`X-GNOME-Autostart-enabled=false` ou `Hidden=true`) ou apagar o arquivo, o
  menu se atualiza na hora (inotify).
- **No login, o app abre com `--hidden`:** só o ícone da bandeja aparece. A
  página carrega como `hidden` (`paintWhenInitiallyHidden: false`), com as
  notificações funcionando e sem marcar como lida a conversa aberta. Abrir o
  app de novo pelo lançador traz a janela.
- **`X-GNOME-Autostart-Delay=3`** dá tempo para a extensão AppIndicator
  registrar a bandeja.
- **Correção automática:** se o caminho de execução mudar (AppImage movido,
  outro checkout), o `Exec` é reescrito na próxima inicialização.
- **Comando no `Exec`:** em dev, `electron <projeto>`; num AppImage, o caminho
  do `.AppImage` (`$APPIMAGE`, não o ponto de montagem temporário); empacotado,
  o executável instalado.

**Configurações** ficam em `~/.config/wa-gnome/settings.json`, com chaves
validadas, escrita atômica e um arquivo corrompido movido para `.corrupt`:

| Chave | Padrão | Efeito |
|-------|--------|--------|
| `startHiddenOnLogin` | `true` | autostart inicia com `--hidden` |

**Lançador (`npm run desktop:install`):** instala
`~/.local/share/applications/io.github.wagnome.WaGnome.desktop` e os ícones
em `~/.local/share/icons/hicolor/*/apps/`. Com isso o app aparece no menu de
aplicativos, o dock agrupa a janela pelo `app_id` do Wayland e as notificações
passam a mostrar nome e ícone. A entrada passa pelo `desktop-file-validate` e
é encontrada pelo `Gio.DesktopAppInfo`. O pacote `.deb` traz a sua própria
entrada em `/usr/share/applications`. No AppImage, rode
`./wa-gnome-<versão>-x86_64.AppImage --install-desktop-entry`.

## Logs e erros

- **Arquivo:** `~/.local/state/wa-gnome/wa-gnome.log` (`$XDG_STATE_HOME`),
  pasta 0700 e arquivo 0600. Gira em 1 MiB e mantém 3 arquivos antigos
  (`.1`–`.3`). Também vai para o terminal.
- **O que entra:** início (versões, Wayland/X11), janela mostrada/oculta,
  bandeja, autostart, falhas de carregamento com nova tentativa, renderer
  travado ou encerrado, processos filhos (GPU, rede) que caem, exceções não
  tratadas. Nunca o conteúdo das mensagens.
- **Erro fatal na inicialização:** uma caixa de diálogo mostra o erro e o
  caminho do log, e o app sai com código 1.
- **Encerramento:** "Sair", Ctrl+Q e SIGTERM (logout, `kill`) passam pelo
  `before-quit`, que grava a sessão em disco. O próprio Electron trata
  SIGTERM/SIGINT com um encerramento ordenado (verificado: `kill -TERM` gera
  "quitting" no log e sai sem processos restantes).

## Pacotes (AppImage e .deb)

```bash
npm run dist     # typecheck + testes + build + electron-builder
ls dist/         # wa-gnome-0.1.0-x86_64.AppImage, wa-gnome_0.1.0_amd64.deb
```

**.deb**: `sudo apt install ./dist/wa-gnome_0.1.0_amd64.deb`

- Instala em `/opt/wa-gnome`, com o link `/usr/bin/wa-gnome`, a entrada
  `/usr/share/applications/io.github.wagnome.WaGnome.desktop` e os ícones
  `hicolor/*/apps/wa-gnome.png`.
- O `postinst` instala o perfil AppArmor `/etc/apparmor.d/wa-gnome` (só
  `userns`, sem confinamento). O Ubuntu 24.04+ exige isso para o sandbox do
  Chromium (`kernel.apparmor_restrict_unprivileged_userns=1`). O perfil passa
  no `apparmor_parser` desta máquina.
- Dependências conferidas com `apt-get install -s` no 26.04 (os nomes antigos
  são fornecidos pelos pacotes `t64`).
- Remover: `sudo apt remove wa-gnome`.

**AppImage**: `chmod +x` e execute.

- Usa o runtime estático (`toolsets.appimage: 1.0.3`), porque o Ubuntu 24.04+
  não instala mais a `libfuse2` que o runtime antigo exige.
- O sandbox continua ativo: renderers em user/PID namespaces próprios e
  seccomp em modo filtro, verificado em `/proc` no 26.04.
- O autostart e o lançador usam o caminho do AppImage (`$APPIMAGE`). Se mover
  o arquivo, o autostart se corrige na próxima execução. O lançador, não: rode
  `--install-desktop-entry` de novo.

**Antes de distribuir**: troque o `maintainer` provisório em
`electron-builder.yml` e o `homepage` em `package.json`.

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
  notificação depois de *Sair* ou durante a suspensão. Com *Iniciar com o
  sistema* ativo, o app já está rodando após o login. Ao acordar, o WhatsApp reconecta e entrega
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
- **Logout encerra todos os processos de uma vez:** o systemd manda SIGTERM ao
  escopo inteiro, então os processos filhos (GPU e rede) morrem junto com o
  principal. O Chromium pode registrar "GPU process isn't usable. Goodbye." e
  sair com erro. Isso acontece depois do `before-quit`, ou seja, depois de a
  sessão ser gravada em disco.
