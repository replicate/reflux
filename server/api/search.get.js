export default defineEventHandler(async (event) => {
  try {
    const { token, q } = getQuery(event)

    const result = await fetch(`https://api.replicate.com/v1/models`, {
      method: 'QUERY',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      body: q
    })

    const data = await result.json()

    const filtered = data.results
      .filter(
        (i) =>
          i?.latest_version?.openapi_schema?.components?.schemas?.TrainingInput
      )
      .map((i) => ({
        name: `${i.owner} / ${i.name}`,
        version: i?.latest_version?.id
      }))

    return filtered
  } catch (e) {
    console.log('--- error (api/search): ', e)

    return {
      error: e.message
    }
  }
})
