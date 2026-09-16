import { Provider } from 'ltijs'

const provider = new Provider({
  database: { url: 'mongodb://mongodb/ltijs' },
})

provider.onResourceLink(async (context, request, response) => {
  response.html(`Hello, ${context.idToken.user.name ?? 'learner'}!`)
})

await provider.listen()
