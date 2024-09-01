export default defineEventHandler(async (event) => {
  try {
    const { token, ids } = getQuery(event)
    const id_array = ids.split(',')

    const results = await Promise.all(
      id_array.map((id) =>
        fetch(`https://api.replicate.com/v1/predictions/${id}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'ReFlux/1.0'
          }
        })
      )
    )

    const predictions = await Promise.all(
      results.map((result) => result.json())
    )

    // Remove potentially long data
    // delete json.logs

    return predictions
  } catch (e) {
    console.log('--- error (api/prediction): ', e)

    return {
      error: e.message
    }
  }
})
