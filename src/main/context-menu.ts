import { Menu, type MenuItemConstructorOptions, type WebContents } from 'electron'
import { STRINGS } from '../shared/strings'

const T = STRINGS.contextMenu

export function attachContextMenu(wc: WebContents): void {
  wc.on('context-menu', (_event, params) => {
    const items: MenuItemConstructorOptions[] = []

    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        items.push({ label: suggestion, click: () => wc.replaceMisspelling(suggestion) })
      }
      items.push(
        {
          label: T.addToDictionary,
          click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord)
        },
        { type: 'separator' }
      )
    }

    const { editFlags } = params
    if (params.isEditable) {
      items.push(
        { role: 'cut', label: T.cut, enabled: editFlags.canCut },
        { role: 'copy', label: T.copy, enabled: editFlags.canCopy },
        { role: 'paste', label: T.paste, enabled: editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', label: T.selectAll, enabled: editFlags.canSelectAll }
      )
    } else if (params.selectionText.trim().length > 0) {
      items.push({ role: 'copy', label: T.copy })
    }

    if (items.length > 0) Menu.buildFromTemplate(items).popup()
  })
}
