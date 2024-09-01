import { useLocalStorage } from '@vueuse/core'

const parseAspectRatio = (aspectRatio) => {
  const [width, height] = aspectRatio.split(':').map(Number)
  return { width, height }
}

const urlToBase64 = async (urlOrArray) => {
  const convertSingle = async (url) => {
    if (typeof url !== 'string' || !url.startsWith('https')) {
      return url
    }

    try {
      // Try to extract file extension from URL
      const urlParts = url.split('/')
      const fileName = urlParts[urlParts.length - 1]
      const fileExtension = fileName.split('.').pop().toLowerCase()

      const response = await fetch(url)
      const blob = await response.blob()

      // Determine file type
      let fileType
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) {
        fileType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`
      } else {
        fileType = blob.type || 'application/octet-stream'
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64data = reader.result
          const dataUri = `data:${fileType};base64,${base64data.split(',')[1]}`
          resolve(dataUri)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Error converting URL to base64:', error)
      return url
    }
  }

  if (Array.isArray(urlOrArray)) {
    return Promise.all(urlOrArray.map(convertSingle))
  } else {
    return convertSingle(urlOrArray)
  }
}

export const usePredictionStore = defineStore('predictionStore', {
  state: () => ({
    replicate_api_token: useLocalStorage('reflux-replicate-api-token', null),
    outputs: useLocalStorage('reflux-outputs', [])
  }),
  actions: {
    async createBatch({ versions, num_outputs, merge, input }) {
      try {
        const predictions = await Promise.all(
          versions.length === 2 && merge
            ? Array.from(Array(num_outputs).keys()).map(() =>
                $fetch('/api/prediction', {
                  method: 'POST',
                  body: {
                    replicate_api_token: this.replicate_api_token,
                    version: versions[0],
                    input: {
                      ...input,
                      extra_lora: flux.getOwnerNameByVersion(versions[1]),
                      extra_lora_scale: input.lora_scale, // For now
                      seed: Math.floor(Math.random() * 1000)
                    }
                  }
                })
              )
            : versions.length > 1
            ? versions.map((version) =>
                $fetch('/api/prediction', {
                  method: 'POST',
                  body: {
                    replicate_api_token: this.replicate_api_token,
                    version,
                    input
                  }
                })
              )
            : Array.from(Array(num_outputs).keys()).map(() =>
                $fetch('/api/prediction', {
                  method: 'POST',
                  body: {
                    replicate_api_token: this.replicate_api_token,
                    version: versions[0],
                    input: {
                      ...input,
                      seed: Math.floor(Math.random() * 1000)
                    }
                  }
                })
              )
        )

        const baseSize = 300
        const aspectRatio = parseAspectRatio(input.aspect_ratio)
        const width = baseSize
        const height = (aspectRatio.width / aspectRatio.height) * baseSize

        predictions.forEach((prediction, index) => {
          this.outputs.push({
            id: prediction.id,
            status: prediction.status,
            input,
            output: null,
            metadata: {
              prediction_id: prediction.id,
              name: flux.getOwnerNameByVersion(prediction.version),
              x: 0,
              y: 0,
              rotation: 0,
              width,
              height
            }
          })
        })

        return predictions
      } catch (e) {
        console.log('--- (stores/prediction) error:', e.message)
      }
    },
    async pollIncompletePredictions() {
      try {
        const prediction_ids = [
          ...new Set(
            this.incompleteOutputs
              .map((output) => output?.metadata?.prediction_id || null)
              .filter((id) => id)
          )
        ]
        const predictions = await $fetch(
          `/api/prediction?ids=${prediction_ids.join(',')}&token=${
            this.replicate_api_token
          }`
        )

        for (const prediction of predictions) {
          // Update outputs with the same prediction_id in the state
          const targets = this.outputs.filter(
            (i) => i?.metadata?.prediction_id === prediction.id
          )

          for (const target of targets) {
            // Update the corresponding output in the state
            const index = this.outputs.findIndex((i) => i.id === target.id)
            if (index !== -1) {
              this.outputs[index] = {
                ...this.outputs[index],
                input: prediction.input,
                status: prediction.status,
                output: await urlToBase64(prediction.output)
              }
            }
          }
        }

        /*
        // Update the corresponding output in the state
        const index = this.outputs.findIndex((i) => i.id === output.id)
        if (index !== -1) {
          this.outputs[index] = {
            ...this.outputs[index],
            input: result.input,
            status: result.status,
            output: result.output
          }
        }
        */
      } catch (e) {
        console.log(
          '--- (stores/prediction) error polling incomplete predictions:',
          e.message
        )
      }
    },
    updateOutputPosition({ id, x, y, rotation, width, height }) {
      const index = this.outputs.findIndex((output) => output.id === id)
      if (index !== -1) {
        this.outputs[index].metadata.x = x
        this.outputs[index].metadata.y = y
        this.outputs[index].metadata.rotation = rotation
        if (width !== undefined) this.outputs[index].metadata.width = width
        if (height !== undefined) this.outputs[index].metadata.height = height
      }
    },
    addOutput(output) {
      if (Array.isArray(output)) {
        this.outputs.push(...output)
      } else {
        this.outputs.push(output)
      }
    },
    removeOutput(id) {
      if (Array.isArray(id)) {
        this.outputs = this.outputs.filter((output) => !id.includes(output.id))
      } else {
        this.outputs = this.outputs.filter((output) => output.id !== id)
      }
    }
  },
  getters: {
    incompleteOutputs: (state) =>
      state.outputs.filter(
        (output) => output.status !== 'succeeded' && output.status !== 'failed'
      )
  }
})
