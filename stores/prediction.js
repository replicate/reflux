import { useLocalStorage } from '@vueuse/core'

const parseAspectRatio = (aspectRatio) => {
  const [width, height] = aspectRatio.split(':').map(Number)
  return { width, height }
}

export const usePredictionStore = defineStore('predictionStore', {
  state: () => ({
    outputs: useLocalStorage('reflux-outputs', [])
  }),
  actions: {
    async createBatch({ replicate_api_token, versions, input }) {
      try {
        const predictions = await Promise.all(
          versions.map((version) =>
            $fetch('/api/prediction', {
              method: 'POST',
              body: {
                replicate_api_token,
                version,
                input
              }
            })
          )
        )

        const dotSpacing = 20 // Match the value in Canvas.vue
        const baseSize = 300 // This should match the baseSize in Canvas.vue
        const centerX =
          Math.round(window.innerWidth / 2 / dotSpacing) * dotSpacing
        const centerY =
          Math.round(window.innerHeight / 2 / dotSpacing) * dotSpacing

        const gridSize = Math.ceil(Math.sqrt(predictions.length))
        let currentRow = 0
        let currentCol = 0

        const placedImages = []

        predictions.forEach((prediction, index) => {
          const aspectRatio = parseAspectRatio(input.aspect_ratio)
          const width = Math.round(
            baseSize * (aspectRatio.width / aspectRatio.height)
          )
          const height = baseSize

          let x, y
          let overlap = true

          while (overlap) {
            x =
              centerX +
              (currentCol - Math.floor(gridSize / 2)) * (width + dotSpacing)
            y =
              centerY +
              (currentRow - Math.floor(gridSize / 2)) * (height + dotSpacing)

            overlap = placedImages.some(
              (img) =>
                x < img.x + img.width + dotSpacing &&
                x + width + dotSpacing > img.x &&
                y < img.y + img.height + dotSpacing &&
                y + height + dotSpacing > img.y
            )

            if (overlap) {
              currentCol++
              if (currentCol >= gridSize) {
                currentCol = 0
                currentRow++
              }
            }
          }

          placedImages.push({ x, y, width, height })

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
          if (currentCol >= gridSize) {
            currentCol = 0
            currentRow++
          }
        })

        // Start polling for each prediction
        predictions.forEach((prediction) => {
          this.pollPrediction(prediction.id, replicate_api_token)
        })

        return predictions
      } catch (e) {
        console.log('--- (stores/prediction) error:', e.message)
      }
    },
    async pollPrediction(prediction_id, replicate_api_token) {
      const pollInterval = 2000 // Poll every 2 second
      const maxAttempts = 60 // Max 1 minute of polling

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const result = await $fetch(
            `/api/prediction?id=${prediction_id}&token=${replicate_api_token}`
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

          if (result.status === 'succeeded' || result.status === 'failed') {
            break // Stop polling if the prediction is complete or failed
          }

          await new Promise((resolve) => setTimeout(resolve, pollInterval))
        } catch (e) {
          console.log(
            `--- (stores/prediction) error polling prediction ${prediction_id}:`,
            e.message
          )
          break
        }
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
      this.outputs = this.outputs.filter((output) => output.id !== id)
    }
  }
})
