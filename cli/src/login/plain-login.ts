import { createLocalAuthToken } from '@codebuff/common/config/load-config'
import { cyan, green } from 'picocolors'

import { saveUserCredentials } from '../utils/auth'

/**
 * Plain-text login flow that runs outside the TUI.
 * Prints the login URL as plain text so the user can select and copy it
 * using normal terminal text selection (Cmd+C / Ctrl+Shift+C).
 *
 * This is the escape hatch for remote/SSH environments where the TUI's
 * clipboard and browser integration don't work.
 */
export async function runPlainLogin(): Promise<void> {
  const user = {
    id: 'local-mode-user',
    name: 'Local Mode',
    email: 'local-mode@codebuff.local',
    authToken: createLocalAuthToken(),
  }
  saveUserCredentials(user)
  console.log()
  console.log(green('✓ Local auth initialized'))
  console.log('You can now run ' + cyan('codebuffv2') + ' to start.')
  process.exit(0)
}
