import JSZip from 'jszip'

const downloadAndZipImages = async (urls) => {
  const zip = new JSZip()
  const promises = urls.map(async (url) => {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const fileName = url.split('/').pop()
    zip.file(fileName, arrayBuffer)
  })
  await Promise.all(promises)
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const arrayBuffer = await zipBlob.arrayBuffer()
  const base64data = Buffer.from(arrayBuffer).toString('base64')
  return `data:application/zip;base64,${base64data}`
}

export default defineEventHandler(async (event) => {
  try {
    const { replicate_api_token, destination, input } = await readBody(event)

    // Download and ZIP files
    const input_images_base64 = await downloadAndZipImages(input?.input_images)

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
          input: {
            ...input,
            input_images: input_images_base64
          }
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
