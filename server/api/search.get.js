import models from 'all-the-public-replicate-models'

const getTriggerWord = (model) => {
  const description = model?.description || ''
  const default_example_prompt = model?.default_example?.input.prompt || ''
  const prompt_description =
    model?.latest_version?.openapi_schema?.components?.schemas?.Input
      ?.properties?.prompt?.description || ''

  const checkPatterns = (str) => {
    // Regular expressions for different trigger word patterns
    const quotedPattern = /"([^"]+)"|'([^']+)'/
    const allCapsPattern = /\b[A-Z]{2,}\b/
    const stylePattern = /(\S+(?:\s+\S+)*)\s+style/i

    // Check for quoted words
    const quotedMatch = str.match(quotedPattern)
    if (quotedMatch) return quotedMatch[1] || quotedMatch[2]

    // Check for all-caps words
    const allCapsMatch = str.match(allCapsPattern)
    if (allCapsMatch) return allCapsMatch[0]

    // Check for words followed by 'style'
    // const styleMatch = str.match(stylePattern)
    // if (styleMatch) return styleMatch[1]

    return null
  }

  let word = null
  word = checkPatterns(description)
  if (word) return word
  word = checkPatterns(prompt_description)
  if (word) return word
  word = checkPatterns(default_example_prompt)
  if (word) return word

  // Default return if no trigger word is found
  return 'TOK'
}

export default defineEventHandler(async (event) => {
  try {
    const { token } = getQuery(event)

    // Get trainings
    // TODO: pagination
    const result = await fetch(`https://api.replicate.com/v1/trainings`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'ReFlux/1.0'
      }
    })
    const { results } = await result.json()

    const owner = (
      await Promise.all(
        (results || []).map(async (training) => {
          try {
            // Not a flux training
            if (
              training?.model !== 'ostris/flux-dev-lora-trainer' ||
              training?.status === 'failed'
            ) {
              return null
            }

            const [full_name, version] = training?.output?.version.split(':')
            const [username, name] = full_name.split('/')
            const model_result = await fetch(
              `https://api.replicate.com/v1/models/${username}/${name}`,
              {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  'User-Agent': 'ReFlux/1.0'
                }
              }
            )
            const model = await model_result.json()

            return (
              (model?.name || '') +
              ' ' +
              (model?.description || '')
            ).includes('flux')
              ? {
                  is_owner: true,
                  owner: model.owner,
                  name: model.name,
                  description: model?.description || '',
                  version: model?.latest_version?.id,
                  cover_image_url: model?.cover_image_url || null,
                  trigger: getTriggerWord(model)
                }
              : null
          } catch (e) {
            console.log(e)
            return null
          }
        })
      )
    ).filter((v) => !!v)

    // Use all-the-public-replicate-models package instead
    const _public = models
      .filter(
        (i) =>
          ((i?.name || '') + ' ' + (i?.description || '')).includes('flux') &&
          i?.latest_version?.openapi_schema?.components?.schemas?.TrainingInput
      )
      .map((i) => ({
        is_owner: false,
        owner: i.owner,
        name: i.name,
        description: i?.description || '',
        version: i?.latest_version?.id,
        cover_image_url: i?.cover_image_url || null,
        trigger: getTriggerWord(i)
      }))

    return [...owner, ..._public]
  } catch (e) {
    console.log('--- error (api/search): ', e)

    return {
      error: e.message
    }
  }
})
