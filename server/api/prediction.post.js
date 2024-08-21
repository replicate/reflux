export default defineEventHandler(async (event) => {
  try {
    const { replicate_api_token, version, input } = await readBody(event)

    const result = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${replicate_api_token}`
      },
      body: JSON.stringify({
        version,
        input
      })
    })

    const prediction = await result.json()

    return prediction
  } catch (e) {
    console.log('--- error (api/prediction): ', e)

    return {
      error: e.message
    }
  }
})
