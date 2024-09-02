export default defineEventHandler(async (event) => {
  try {
    const {
      replicate_api_token,
      name,
      trigger_word,
      visibility = 'public'
    } = await readBody(event)

    // Get username
    let result = await fetch('https://api.replicate.com/v1/account', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${replicate_api_token}`,
        'User-Agent': 'ReFlux/1.0'
      }
    })
    const { username } = await result.json()

    // Check if model already exists
    result = await fetch(
      `https://api.replicate.com/v1/models/${username}/${name}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${replicate_api_token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ReFlux/1.0'
        }
      }
    )
    let model = await result.json()

    // Create model
    if (!model?.name) {
      result = await fetch('https://api.replicate.com/v1/models', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${replicate_api_token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'ReFlux/1.0'
        },
        body: JSON.stringify({
          owner: username,
          name,
          description: `A fine-tuned FLUX.1 model. Use trigger word "${
            trigger_word || 'TOK'
          }". Created with ReFlux (https://reflux.replicate.dev).`,
          hardware: 'gpu-t4',
          visibility
        })
      })

      model = await result.json()
    }

    return model
  } catch (e) {
    console.log('--- error (api/model): ', e)

    return {
      error: e.message
    }
  }
})
