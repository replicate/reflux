import { useLocalStorage } from '@vueuse/core'

const parseAspectRatio = (aspectRatio) => {
  const [width, height] = aspectRatio.split(':').map(Number)
  return { width, height }
}

export const usePredictionStore = defineStore('predictionStore', {
  state: () => ({
    replicate_api_token: useLocalStorage('reflux-replicate-api-token', null),
    outputs: useLocalStorage('reflux-outputs', [])
  }),
  actions: {
    async createBatch({ versions, num_outputs, input }) {
      try {
        const predictions = await Promise.all(
          versions.length > 1
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

        const dotSpacing = 20
        const baseSize = 300
        const aspectRatio = parseAspectRatio(input.aspect_ratio)
        const width = Math.round(
          baseSize * (aspectRatio.width / aspectRatio.height)
        )
        const height = baseSize

        // Calculate the bounding box for all new images
        const totalWidth =
          Math.ceil(Math.sqrt(predictions.length)) * (width + dotSpacing)
        const totalHeight =
          Math.ceil(Math.sqrt(predictions.length)) * (height + dotSpacing)

        // Find the lowest y-coordinate of existing images
        const lowestY = this.outputs.reduce(
          (max, output) =>
            Math.max(max, output.metadata.y + output.metadata.height),
          0
        )

        // Calculate the starting position for the new images
        const startX =
          Math.round(window.innerWidth / 2 / dotSpacing) * dotSpacing -
          totalWidth / 2
        const startY = lowestY + dotSpacing

        let currentRow = 0
        let currentCol = 0

        predictions.forEach((prediction) => {
          const x = startX + currentCol * (width + dotSpacing)
          const y = startY + currentRow * (height + dotSpacing)

          this.outputs.push({
            id: prediction.id,
            status: prediction.status,
            input,
            output: null,
            metadata: {
              name: flux.getNameByVersion(prediction.version),
              x,
              y,
              width,
              height
            }
          })

          currentCol++
          if (currentCol * (width + dotSpacing) >= totalWidth) {
            currentCol = 0
            currentRow++
          }
        })

        return predictions
      } catch (e) {
        console.log('--- (stores/prediction) error:', e.message)
      }
    },
    async pollPrediction(prediction_id) {
      try {
        const result = await $fetch(
          `/api/prediction?id=${prediction_id}&token=${this.replicate_api_token}`
        )

        // Update the corresponding output in the state
        const index = this.outputs.findIndex(
          (output) => output.id === prediction_id
        )
        if (index !== -1) {
          this.outputs[index] = {
            ...this.outputs[index],
            id: prediction_id,
            input: result.input,
            status: result.status,
            output: result.output
          }
        }
      } catch (e) {
        console.log(
          `--- (stores/prediction) error polling prediction ${prediction_id}:`,
          e.message
        )
      }
    },
    updateOutputPosition({ id, x, y }) {
      const index = this.outputs.findIndex((output) => output.id === id)
      if (index !== -1) {
        const dotSpacing = 40 // Make sure this matches the value in Canvas.vue
        this.outputs[index].metadata.x = Math.round(x / dotSpacing) * dotSpacing
        this.outputs[index].metadata.y = Math.round(y / dotSpacing) * dotSpacing
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
