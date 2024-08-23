<template lang="pug">
.flex.flex-col.gap-y-4

  //- Models
  u-form-group(
    label="Flux finetunes"
    name="versions"
  )
    u-select-menu(
      v-model="versions"
      :options="version_options"
      option-attribute="name"
      value-attribute="version"
      multiple
      required
    )
  u-form-group(
    v-if="trigger_words.length > 0"
    label="Trigger words"
  )
    .flex.flex-col.gap-y-2
      .flex.items-center(
        v-for="(trigger, i) in trigger_words"
        :key="`trigger-word-${i}`"
      )
        .text-xs.flex-grow {{ trigger.name }}:
        .flex.gap-x-2
          u-badge(
            color="gray"
            size="xs"
          ) {{ trigger.word }}
          u-button(
            @click="versions = versions.filter((v) => v !== trigger.version)"
            color="white"
            icon="i-heroicons-trash"
            size="xs"
            square
          )
  //- Prompt
  u-form-group(
    label="Prompt"
    name="prompt"
  )
    u-textarea(
      v-model="prompt"
      placeholder="Write a prompt..."
      autoresize
    )
  //- Aspect ratio
  u-form-group(
    label="Aspect ratio"
    name="aspect_ratio"
  )
    u-select-menu(
      v-model="aspect_ratio"
      :options="aspect_ratio_options"
    )
  //- Number of outputs (conditional)
  u-form-group(
    v-if="versions.length <= 1"
    label="Number of outputs"
    name="num_outputs"
  )
    .flex.items-center.gap-x-4
      u-range.flex-grow(
        v-model="num_outputs"
        :min="1"
        :max="4"
        :step="1"
      )
      u-input.w-24(
        v-model="num_outputs"
        type="number"
        min="1"
        max="4"
        step="1"
      )
  //- LoRA scale
  u-form-group(
    label="LoRA scale"
    name="lora_scale"
  )
    .flex.items-center.gap-x-4
      u-range.flex-grow(
        v-model="lora_scale"
        :min="-1"
        :max="2"
        :step="0.01"
      )
      u-input.w-24(
        v-model="lora_scale"
        type="number"
        min="-1"
        max="2"
        step="0.01"
      )
  //- Inference steps
  u-form-group(
    label="Steps"
    name="num_inference_steps"
  )
    .flex.items-center.gap-x-4
      u-range.flex-grow(
        v-model="num_inference_steps"
        :min="1"
        :max="50"
        :step="1"
      )
      u-input.w-24(
        v-model="num_inference_steps"
        type="number"
        min="1"
        max="50"
        step="1"
      )
  //- Guidance scale
  u-form-group(
    label="Gudance"
    name="guidance_scale"
  )
    .flex.items-center.gap-x-4
      u-range.flex-grow(
        v-model="guidance_scale"
        :min="0"
        :max="10"
        :step="0.01"
      )
      u-input.w-24(
        v-model="guidance_scale"
        type="number"
        min="0"
        max="10"
        step="0.01"
      )
  //- Seed
  u-form-group(
    label="Seed"
    name="seed"
  )
    u-input(
      v-model="seed"
      placeholder="Seed..."
      type="number"
    )
  //- Output format
  u-form-group(
    label="Output format"
    name="output_format"
  )
    u-select-menu(
      v-model="output_format"
      :options="output_format_options"
    )
  //- Output quality
  u-form-group(
    label="Output quality"
    name="output_quality"
  )
    .flex.items-center.gap-x-4
      u-range.flex-grow(
        v-model="output_quality"
        :min="0"
        :max="100"
        :step="1"
      )
      u-input.w-24(
        v-model="output_quality"
        type="number"
        min="0"
        max="100"
        step="1"
      )
  //- Submit
  u-button(
    v-if="replicate_api_token"
    @click="submit"
    :disabled="loading || !replicate_api_token"
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
</template>

<script>
import { useLocalStorage } from '@vueuse/core'
import { mapActions } from 'pinia'

export default {
  name: 'UiFormCreate',
  setup: () => ({
    replicate_api_token: useLocalStorage('reflux-replicate-api-token', null),
    versions: useLocalStorage('reflux-versions', []),
    prompt: useLocalStorage('reflux-prompt', ''),
    aspect_ratio: useLocalStorage('reflux-aspect_ratio', '1:1'),
    num_outputs: useLocalStorage('reflux-num_outputs', 1),
    lora_scale: useLocalStorage('reflux-lora_scale', 1),
    num_inference_steps: useLocalStorage('reflux-num_inference_steps', 28),
    model: useLocalStorage('reflux-model', 'dev'),
    guidance_scale: useLocalStorage('reflux-guidance_scale', 3.5),
    seed: useLocalStorage('reflux-seed', null),
    output_format: useLocalStorage('reflux-output_format', 'webp'),
    output_quality: useLocalStorage('reflux-output_quality', 80)
  }),
  data: () => ({
    loading: false,
    version_options: flux.version_options,
    aspect_ratio_options: [
      '1:1',
      '16:9',
      '21:9',
      '3:2',
      '2:3',
      '4:5',
      '5:4',
      '3:4',
      '4:3',
      '9:16',
      '9:21'
    ],
    output_format_options: ['webp', 'jpg', 'png']
  }),
  computed: {
    trigger_words() {
      return this.versions.map((version) => ({
        version,
        name: flux.getNameByVersion(version),
        word: flux.getTriggerByVersion(version)
      }))
    }
  },
  watch: {
    replicate_api_token: {
      immediate: true,
      async handler(token) {
        if (!token) return

        try {
          const versions = await $fetch('/api/search')
          // Dedupe by version key and sort alphabetically by name
          const versionMap = new Map(
            [...this.version_options, ...versions].map((v) => [v.version, v])
          )
          const version_options = Array.from(versionMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          )

          // Persist
          flux.setVersionOptions([])
          flux.setVersionOptions(version_options)
        } catch (e) {
          console.log('--- (create) error:', e.message)
        }
      }
    }
  },
  methods: {
    ...mapActions(usePredictionStore, ['createBatch']),
    async submit() {
      this.loading = true
      try {
        await this.createBatch({
          versions: this.versions,
          num_outputs: this.num_outputs,
          input: {
            prompt: this.prompt,
            aspect_ratio: this.aspect_ratio,
            lora_scale: this.lora_scale,
            num_inference_steps: this.num_inference_steps,
            model: this.model,
            guidance_scale: this.guidance_scale,
            seed: this.seed || Math.floor(Math.random() * 1000),
            output_format: this.output_format,
            output_quality: this.output_quality
          }
        })
      } catch (e) {
        console.log('--- (create): error', e.message)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="stylus" scoped></style>
