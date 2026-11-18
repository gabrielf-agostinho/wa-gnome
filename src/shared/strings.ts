export const STRINGS = {
  appName: 'wa-gnome',
  genericName: 'WhatsApp',
  windowTitle: 'WhatsApp',
  unread: {
    none: 'Nenhuma conversa não lida',
    one: '1 conversa não lida',
    many: (count: number) => `${count} conversas não lidas`
  },
  tray: {
    tooltip: (summary: string) => `WhatsApp — ${summary}`,
    open: 'Abrir WhatsApp',
    hide: 'Ocultar janela',
    autostart: 'Iniciar com o sistema',
    quit: 'Sair'
  },
  contextMenu: {
    addToDictionary: 'Adicionar ao dicionário',
    cut: 'Recortar',
    copy: 'Copiar',
    paste: 'Colar',
    selectAll: 'Selecionar tudo'
  },
  notifications: {
    autostartFailed: 'Não foi possível alterar a inicialização automática',
    hiddenWithoutTrayTitle: 'WhatsApp continua em execução',
    hiddenWithoutTrayBody:
      'A bandeja do sistema não está disponível (ative a extensão "Ubuntu AppIndicators"). ' +
      'Para reabrir, inicie o wa-gnome novamente.'
  },
  desktopEntry: {
    launcherComment: 'WhatsApp Web com bandeja e notificações em segundo plano',
    autostartComment: 'Mantém o WhatsApp Web em segundo plano para receber notificações',
    keywords: 'WhatsApp;chat;mensagens;messenger;'
  },
  startupError: {
    title: 'wa-gnome não pôde iniciar',
    details: (path: string) => `Detalhes em ${path}`
  }
} as const
