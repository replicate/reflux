import { useLocalStorage } from '@vueuse/core'

import { useVersionStore } from './version'

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
    outputs: useLocalStorage('reflux-outputs', []),
    trainings: useLocalStorage('reflux-trainings', [])
  }),
  actions: {
    async createBatch({ versions, hf_versions, num_outputs, merge, input }) {
      try {
        const versionStore = useVersionStore()
        const combined_versions = [...versions, ...hf_versions]

        let promises = []

        // Merging, use num_outputs
        if (combined_versions.length === 2 && merge) {
          // Use the Replicate model + side car
          if (versions.length > 0) {
            const extra_lora =
              hf_versions.length > 0
                ? `huggingface.co/${hf_versions[0]}`
                : versionStore.getOwnerNameByVersion(versions[1])

            promises = Array.from(Array(num_outputs).keys()).map(() =>
              $fetch('/api/prediction', {
                method: 'POST',
                body: {
                  replicate_api_token: this.replicate_api_token,
                  version: versions[0],
                  input: {
                    ...input,
                    extra_lora,
                    extra_lora_scale: input.lora_scale, // For now
                    seed: Math.floor(Math.random() * 1000)
                  }
                }
              })
            )
            // Use lucataco/flux-dev-multi-lora
          } else {
            promises = Array.from(Array(num_outputs).keys()).map(() =>
              $fetch('/api/prediction', {
                method: 'POST',
                body: {
                  replicate_api_token: this.replicate_api_token,
                  // https://replicate.com/lucataco/flux-dev-multi-lora
                  version:
                    'a738942df15c8c788b076ddd052256ba7923aade687b12109ccc64b2c3483aa1',
                  input: {
                    ...input,
                    hf_loras: hf_versions,
                    lora_scales: Array.from(
                      Array(hf_versions.length).keys()
                    ).map(() => input.lora_scale),
                    seed: Math.floor(Math.random() * 1000)
                  }
                }
              })
            )
          }
          // Not merging, use num_outputs
        } else if (combined_versions.length < 2) {
          if (versions.length > 0) {
            promises = Array.from(Array(num_outputs).keys()).map(() =>
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
          } else if (hf_versions.length > 0) {
            promises = Array.from(Array(num_outputs).keys()).map(() =>
              $fetch('/api/prediction', {
                method: 'POST',
                body: {
                  replicate_api_token: this.replicate_api_token,
                  // https://replicate.com/lucataco/flux-dev-multi-lora
                  version:
                    'a738942df15c8c788b076ddd052256ba7923aade687b12109ccc64b2c3483aa1',
                  input: {
                    ...input,
                    hf_loras: [hf_versions[0]],
                    lora_scales: [input.lora_scale],
                    seed: Math.floor(Math.random() * 1000)
                  }
                }
              })
            )
          }

          // Not merging, create one of each
        } else {
          promises.push(
            ...versions.map((version) =>
              $fetch('/api/prediction', {
                method: 'POST',
                body: {
                  replicate_api_token: this.replicate_api_token,
                  version,
                  input
                }
              })
            ),
            ...hf_versions.map((hf_version) =>
              $fetch('/api/prediction', {
                method: 'POST',
                body: {
                  replicate_api_token: this.replicate_api_token,
                  // https://replicate.com/lucataco/flux-dev-multi-lora
                  version:
                    'a738942df15c8c788b076ddd052256ba7923aade687b12109ccc64b2c3483aa1',
                  input: {
                    ...input,
                    hf_loras: [hf_version],
                    lora_scales: [input.lora_scale]
                  }
                }
              })
            )
          )
        }

        const predictions = await Promise.all(promises)

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
              name: versionStore.getOwnerNameByVersion(prediction.version),
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
    async createTrainingPrestep({ name, trigger_word, visibility, input }) {
      try {
        const model = await $fetch('/api/model', {
          method: 'POST',
          body: {
            replicate_api_token: this.replicate_api_token,
            name,
            trigger_word,
            visibility
          }
        })

        if (!model?.owner) {
          throw new Error('failed to create model')
        }

        const prediction = await $fetch('/api/prediction', {
          method: 'POST',
          body: {
            replicate_api_token: this.replicate_api_token,
            // https://replicate.com/fofr/consistent-character
            version:
              '9c77a3c2f884193fcee4d89645f02a0b9def9434f9e03cb98460456b831c8772',
            input: {
              ...input,
              number_of_outputs: 15,
              number_of_images_per_pose: 1,
              randomise_poses: true,
              output_format: 'webp',
              output_quality: 80
            }
          }
        })

        this.trainings.push({
          id: prediction.id,
          status: prediction.status,
          input,
          output: null,
          metadata: {
            prediction_id: prediction.id,
            pipeline_stage: 'preprocessing',
            trigger_word,
            destination: model
          }
        })

        return prediction
      } catch (e) {
        console.log('--- (stores/prediction) error:', e.message)
      }
    },
    async createTraining(training) {
      try {
        const { trigger_word, destination } = training?.metadata
        const output = training?.output || []

        // Fail early
        if (output.length <= 0) {
          const index = this.trainings.findIndex((i) => i.id === training.id)
          if (index !== -1) {
            this.trainings[index].status = 'failed'
          }
          return null
        }

        const input = {
          input_images: output,
          trigger_word
        }

        const prediction = await $fetch('/api/training', {
          method: 'POST',
          body: {
            replicate_api_token: this.replicate_api_token,
            destination: `${destination?.owner}/${destination?.name}`,
            input
          }
        })

        // Update training
        const index = this.trainings.findIndex((i) => i.id === training.id)
        if (index !== -1) {
          this.trainings[index].id = prediction.id
          this.trainings[index].status = prediction.status
          this.trainings[index].input = input
          this.trainings[index].output = null
          this.trainings[index].metadata.prediction_id = prediction.id
          this.trainings[index].metadata.pipeline_stage = 'processing'
        }

        return prediction
      } catch (e) {
        console.log('--- (stores/prediction) error:', e.message)
      }
    },
    async pollIncompletePredictions() {
      try {
        const prediction_ids = [
          ...new Set(
            this.incompletePredictions
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
          let targets = this.outputs.filter(
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

          // Update trainings with the same prediction_id in the state
          targets = this.trainings.filter(
            (i) => i?.metadata?.prediction_id === prediction.id
          )

          for (const target of targets) {
            // Update the corresponding output in the state
            const index = this.trainings.findIndex((i) => i.id === target.id)
            if (index !== -1) {
              this.trainings[index] = {
                ...this.trainings[index],
                input: prediction.input,
                status: prediction.status,
                output: prediction.output
              }
            }
          }
        }
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
    incompletePredictions: (state) =>
      [...state.outputs, ...state.trainings].filter(
        (output) => output.status !== 'succeeded' && output.status !== 'failed'
      )
  }
})
