import models from 'all-the-public-replicate-models'

const getTriggerWord = (model) => {
  const description = model?.description || ''
  const default_example_prompt = model?.default_example?.input.prompt || ''
  const prompt_description =
    model?.latest_version?.openapi_schema?.components?.schemas?.Input
      ?.properties?.prompt?.description || ''

  const checkPatterns = (str) => {
    // Regular expressions for different trigger word patterns
    const allCapsPattern = /\b[A-Z]{2,}\b/
    const quotedPattern = /"([^"]+)"|'([^']+)'/
    const stylePattern = /(\S+(?:\s+\S+)*)\s+style/i

    // Check for all-caps words
    const allCapsMatch = str.match(allCapsPattern)
    if (allCapsMatch) return allCapsMatch[0]

    // Check for quoted words
    const quotedMatch = str.match(quotedPattern)
    if (quotedMatch) return quotedMatch[1] || quotedMatch[2]

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
    /*
    const { token, q } = getQuery(event)

    const result = await fetch(`https://api.replicate.com/v1/models`, {
      method: 'QUERY',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
        'User-Agent': 'ReFlux/1.0'
      },
      body: q
    })

    const data = await result.json()

    const filtered = data.results.filter(
      (i) =>
        i?.latest_version?.openapi_schema?.components?.schemas?.TrainingInput
    )
      .map((i) => ({
        name: `${i.owner} / ${i.name}`,
        version: i?.latest_version?.id
      }))
    */

    // Use all-the-public-replicate-models package instead
    const filtered = models
      .filter(
        (i) =>
          ((i?.name || '') + ' ' + (i?.description || '')).includes('flux') &&
          i?.latest_version?.openapi_schema?.components?.schemas?.TrainingInput
      )
      .map((i) => ({
        owner: i.owner,
        name: i.name,
        description: i?.description || '',
        version: i?.latest_version?.id,
        cover_image_url: i?.cover_image_url || null,
        trigger: getTriggerWord(i)
      }))

    return filtered
  } catch (e) {
    console.log('--- error (api/search): ', e)

    return {
      error: e.message
    }
  }
})
