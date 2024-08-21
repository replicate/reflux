export default defineEventHandler(async (event) => {
  try {
    const { token, id } = getQuery(event)

    const result = await fetch(
      `https://api.replicate.com/v1/predictions/${id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    const prediction = await result.json()

    // Remove potentially long data
    // delete json.logs

    return prediction
  } catch (e) {
    console.log('--- error (api/prediction): ', e)

    return {
      error: e.message
    }
  }
})
