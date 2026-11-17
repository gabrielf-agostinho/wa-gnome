import { Menu, type MenuItemConstructorOptions, type WebContents } from 'electron'

export function attachContextMenu(wc: WebContents): void {
  wc.on('context-menu', (_event, params) => {
    const items: MenuItemConstructorOptions[] = []

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        items.push({ label: suggestion, click: () => wc.replaceMisspelling(suggestion) })
      }
      items.push(
        {
          label: 'Adicionar ao dicionário',
          click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord)
        },
        { type: 'separator' }
      )
    }

    const { editFlags } = params
    if (params.isEditable) {
      items.push(
        { role: 'cut', label: 'Recortar', enabled: editFlags.canCut },
        { role: 'copy', label: 'Copiar', enabled: editFlags.canCopy },
        { role: 'paste', label: 'Colar', enabled: editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', label: 'Selecionar tudo', enabled: editFlags.canSelectAll }
      )
    } else if (params.selectionText.trim().length > 0) {
      items.push({ role: 'copy', label: 'Copiar' })
    }

    if (items.length > 0) Menu.buildFromTemplate(items).popup()
  })
}
