<template lang="pug">
.flex.flex-col.gap-y-4

  //- Hidden input
  input(
    @change="onFileSelected"
    type="file"
    ref="file"
    accept="image/*"
    multiple="false"
  )

  //- Subject
  u-form-group(
    label="Subject"
    name="subject"
    hint="Just 1 image!"
  )
    img.rounded.mb-3(
      v-if="subject"
      :src="subject"
    )
    u-button(
      v-if="subject"
      @click="subject = null"
      icon="i-heroicons-trash"
      color="white"
      block
    )
    u-button(
      v-else
      @click="onClickUpload"
      icon="i-heroicons-arrow-up-tray"
      color="white"
      block
      trailing
    ) Click to Upload
  //- Prompt
  u-form-group(
    label="Describe the subject"
    name="prompt"
  )
    u-textarea(
      v-model="prompt"
      placeholder="Describe the subject. Include e.g. clothes and hairstyle."
      autoresize
    )
  //- Destination
  u-form-group(
    label="Fine-tune name"
    name="name"
  )
    u-input(
      v-model="name"
      placeholder="Fine-tune model name"
    )
  //- Trigger word
  u-form-group(
    label="Trigger word"
    name="trigger_word"
  )
    u-input(
      v-model="trigger_word"
      placeholder="Fine-tune trigger word"
    )
  //- Visibility
  u-form-group(
    :ui="{ container: '', hint: 'text-gray-500 dark:text-gray-400 flex align-center' }"
    help="Will this fine-tune be visible on Replicate?"
    label="Public"
    name="visibility"
  )
    template(#hint)
      u-toggle(
        v-model="visibility"
        size="lg"
      )
  //- Submit
  u-button(
    v-if="replicate_api_token"
    @click="submit"
    :disabled="loading || !replicate_api_token || !subject || !prompt || !name || !trigger_word"
    :loading="loading"
    size="xl"
    block
  ) Create

  u-alert.dark(
    v-if="!replicate_api_token"
    color="primary"
    variant="solid"
    description="Please add your Replicate API token in the top right."
  )

  //- Trainings
  template(v-if="trainings")
    u-divider(label="Your fine-tunes")
    u-accordion(
      :items="training_items"
      color="white"
      variant="solid"
      size="lg"
    )
      template(#item="{ item }")
        u-alert(
          :title="item.status"
          :description="item.description"
          :actions="item.actions"
        )
</template>

<script>
import { useLocalStorage } from '@vueuse/core'
import { mapState, mapActions } from 'pinia'

const getFileDimensions = (file) => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const { width, height } = img
      URL.revokeObjectURL(img.src)
      resolve({ width, height })
    }
    img.src = url
  })
}

const calculateAspectRatioFit = (srcWidth, srcHeight, maxWidth, maxHeight) => {
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight)
  return { width: srcWidth * ratio, height: srcHeight * ratio }
}

const bmpToBlob = async (bmp) => {
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('bitmaprenderer')
  if (!ctx) return null
  ctx.transferFromImageBitmap(bmp)
  const blob = await new Promise((res) => canvas.toBlob(res))
  return blob
}

export default {
  name: 'UiFormFinetune',
  setup: () => ({
    replicate_api_token: useLocalStorage('reflux-replicate-api-token', null),
    subject: useLocalStorage('reflux-finetune-subject', null),
    prompt: useLocalStorage('reflux-finetune-prompt', ''),
    name: useLocalStorage('reflux-finetune-name', 'flux-fine-tune'),
    trigger_word: useLocalStorage('reflux-finetune-trigger_word', 'TOK'),
    visibility: useLocalStorage('reflux-finetune-visibility', true)
  }),
  data: () => ({
    loading: false
  }),
  computed: {
    ...mapState(usePredictionStore, ['trainings']),
    training_items() {
      return this.trainings.map((training) => ({
        label: `${training?.metadata?.destination?.owner}/${training?.metadata?.destination?.name}`,
        icon:
          training?.status === 'succeeded'
            ? 'i-heroicons-check'
            : training?.status !== 'failed'
            ? 'i-heroicons-arrow-path'
            : 'i-heroicons-question-mark-circle',
        status: training?.status,
        description:
          training?.status === 'succeeded'
            ? 'The fine-tune is ready to be used!'
            : training?.status !== 'failed'
            ? training?.metadata?.pipeline_stage === 'preprocessing'
              ? 'Synthetic images are generating.'
              : 'The fine-tune is processing.'
            : 'Something unexpected happened.',
        actions: [
          {
            label: 'Prediction',
            icon: 'i-heroicons-arrow-top-right-on-square',
            variant: 'solid',
            color: 'white',
            to: `https://replicate.com/p/${training?.id}`,
            target: '_new'
          }
        ]
      }))
    }
  },
  watch: {
    trainings: {
      immediate: true,
      handler(trainings) {
        // Find trainings that are done preprocessing
        const done_preprocessing = trainings.filter(
          (training) =>
            training?.status === 'succeeded' &&
            training?.metadata?.pipeline_stage === 'preprocessing'
        )

        // Move them to processing stage
        done_preprocessing.forEach((training) => this.createTraining(training))
      }
    }
  },
  methods: {
    ...mapActions(usePredictionStore, [
      'createTrainingPrestep',
      'createTraining'
    ]),
    onClickUpload() {
      if (this.loading) {
        return
      }
      this.$refs.file.click()
    },
    async onFileSelected(e) {
      this.subject = null

      try {
        const file = e.target.files[0]

        // Get uploaded file dimensions
        const { width, height } = await getFileDimensions(file)

        // Resize image (max width/height 1024/1024)
        const { width: resizeWidth, height: resizeHeight } =
          calculateAspectRatioFit(width, height, 1024, 1024)
        const bmp = await createImageBitmap(file, {
          resizeWidth,
          resizeHeight
        })
        const blob = await bmpToBlob(bmp)
        if (!blob) throw new Error('Failed to create blob.')

        const reader = new FileReader()
        reader.onload = () => {
          this.subject = String(reader.result)
        }
        reader.readAsDataURL(blob)
      } catch (e) {
        console.log('--- (finetune) error:', e.message)
      }
    },
    async submit() {
      this.loading = true
      try {
        await this.createTrainingPrestep({
          name: this.name,
          trigger_word: this.trigger_word || 'TOK',
          visibility: this.visibility ? 'public' : 'private',
          input: {
            subject: this.subject,
            prompt: this.prompt
          }
        })

        // Reset form
        this.subject = null
        this.prompt = ''
        this.name = 'flux-fine-tune'
        this.trigger_word = 'TOK'
        this.public = true
      } catch (e) {
        console.log('--- (create): error', e.message)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="stylus" scoped>
div
  input[type="file"]
    display none
</style>
