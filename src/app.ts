import { Provider } from 'ltijs'
import { SqliteDatabaseManager } from './sqlite-database-manager.ts'

const provider = new Provider({
  databaseManager: new SqliteDatabaseManager(process.env.DATABASE_PATH ?? 'data/ltijs.db'),
})

provider.onResourceLink(async (context, request, response) => {
  response.html(`Hello, ${context.idToken.user.name ?? 'learner'}!`)
})

await provider.listen()
