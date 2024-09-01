export default defineEventHandler(async (event) => {
  try {
    const { replicate_api_token, version, input } = await readBody(event)
    let result;

    if (!version) {
      result = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${replicate_api_token}`,
          'User-Agent': 'ReFlux/1.0',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input
        })
      })
    } else {
      result = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${replicate_api_token}`,
          'User-Agent': 'ReFlux/1.0'
        },
        body: JSON.stringify({
          version,
          input
        })
      })
    }

    const prediction = await result.json()

    return prediction
  } catch (e) {
    console.log('--- error (api/prediction): ', e)

    return {
      error: e.message
    }
  }
})
