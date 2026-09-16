// Registers a Moodle (e.g. TUWEL) instance as an LTI 1.3 platform in the ltijs database.
//
// Usage:
//   pnpm register-platform --url https://tuwel.tuwien.ac.at --client-id abc123 [--name TUWEL] [--db mongodb://localhost/ltijs]

import { parseArgs } from 'node:util'
import { IdTokenValidationMethod, Provider } from 'ltijs'

const USAGE = `Usage: pnpm register-platform --url <moodle-url> --client-id <client-id> [options]

Options:
  --url <url>          Base URL of the Moodle instance (e.g. https://tuwel.tuwien.ac.at)
  --client-id <id>     Client ID shown in Moodle's LTI tool configuration
  --name <name>        Display name for the platform (default: TUWEL)
  --db <url>           MongoDB connection URL (default: $DATABASE_URL or mongodb://localhost/ltijs)
  -h, --help           Show this help`

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    'client-id': { type: 'string' },
    name: { type: 'string', default: 'TUWEL' },
    db: { type: 'string', default: process.env.DATABASE_URL ?? 'mongodb://localhost/ltijs' },
    help: { type: 'boolean', short: 'h' },
  },
})

if (values.help) {
  console.log(USAGE)
  process.exit(0)
}

if (values.url === undefined || values['client-id'] === undefined) {
  console.error(`Missing required option(s).\n\n${USAGE}`)
  process.exit(1)
}

const url = values.url.replace(/\/+$/, '')
const clientId = values['client-id']

const provider = new Provider({
  database: { url: values.db },
})

// Only the database is needed here, so connect it directly instead of calling provider.listen(),
// which would also start the HTTP server.
await provider.databaseManager.listen()

try {
  const existing = await provider.platformManager.getPlatformByUrlAndClientId(url, clientId)
  if (existing !== undefined) {
    console.log(`Platform already registered (id: ${existing.id}), nothing to do.`)
  } else {
    const platform = await provider.platformManager.registerPlatform({
      name: values.name,
      url,
      clientId,
      authenticationEndpoint: `${url}/mod/lti/auth.php`,
      accessTokenEndpoint: `${url}/mod/lti/token.php`,
      idTokenValidation: {
        method: IdTokenValidationMethod.JwkSet,
        key: `${url}/mod/lti/certs.php`,
      },
    })
    console.log(`Registered platform "${platform.name}" (id: ${platform.id}).`)
  }
} finally {
  await provider.close()
}
