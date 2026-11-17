const { execFileSync } = require('node:child_process')
const { join } = require('node:path')

exports.default = async function afterPack(context) {
  execFileSync('chmod', ['-R', 'go-w', context.appOutDir, join(context.packager.projectDir, 'resources', 'icons')])
}
