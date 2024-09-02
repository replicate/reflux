export default defineEventHandler(async (event) => {
  try {
    const { replicate_api_token, destination, input } = await readBody(event)

    const result = await fetch(
      'https://api.replicate.com/v1/models/ostris/flux-dev-lora-trainer/versions/7f53f82066bcdfb1c549245a624019c26ca6e3c8034235cd4826425b61e77bec/trainings',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${replicate_api_token}`,
          'User-Agent': 'ReFlux/1.0'
        },
        body: JSON.stringify({
          destination,
          input
        })
      }
    )

    const prediction = await result.json()

    return prediction
  } catch (e) {
    console.log('--- error (api/prediction): ', e)

    return {
      error: e.message
    }
  }
})
