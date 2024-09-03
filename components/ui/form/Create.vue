<template lang="pug">
.flex.flex-col.gap-y-4

  //- Models
  u-form-group(
    label="Flux fine-tunes"
  )
    ui-form-version-picker
    u-button.mr-2.mt-2(
      v-for="(trigger, i) in trigger_words"
      :key="`trigger-word-${i}`"
      @click="prompt += ' ' + trigger.word"
      color="white"
      size="2xs"
      block
    )
      .flex-grow.text-left.font-light.break-all {{ trigger.name }}
      u-divider.mx-1.h-4(orientation="vertical")
      | {{ trigger.word }}
      u-divider.mx-1.h-4(orientation="vertical")
      u-icon.w-4(
        @click.stop="versions = versions.filter((version) => version !== trigger.version)"
        name="i-heroicons-trash"
      )
    u-button.mr-2.mt-2(
      v-for="(version, i) in hf_versions"
      :key="`hf_version-${i}`"
      color="white"
      size="2xs"
      block
    )
      .flex-grow.text-left.font-light.break-all 🤗 {{ version }}
      u-divider.mx-1.h-4(orientation="vertical")
      u-icon.w-4(
        @click.stop="hf_versions = hf_versions.filter((v) => v !== version)"
        name="i-heroicons-trash"
      )
  //- Merge
  u-form-group(
    :ui="{ container: '', hint: 'text-gray-500 dark:text-gray-400 flex align-center' }"
    :help="[...versions, ...hf_versions].length !== 2 ? 'You can only merge two fine-tunes.' : ''"
    label="Merge into same image"
    name="merge"
  )
    template(#hint)
      u-toggle(
        v-model="merge"
        :disabled="[...versions, ...hf_versions].length !== 2"
        size="lg"
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
  //- LoRA scale
  u-form-group(
    label="LoRA scale"
    name="lora_scale"
  )
    .flex.items-center.gap-x-4
      u-range.flex-grow(
        v-model="lora_scale"
        :min="-1"
        :max="1"
        :step="0.01"
      )
      u-input.w-24(
        v-model="lora_scale"
        type="number"
        min="-1"
        max="1"
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
  //- Number of outputs (conditional)
  u-form-group(
    v-if="[...versions, ...hf_versions].length <= 1 || merge"
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
  //- Submit
  u-button(
    v-if="replicate_api_token"
    @click="submit"
    :disabled="loading || !replicate_api_token || [...versions, ...hf_versions].length <= 0"
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
import { mapState, mapActions } from 'pinia'

export default {
  name: 'UiFormCreate',
  setup: () => ({
    replicate_api_token: useLocalStorage('reflux-replicate-api-token', null),
    versions: useLocalStorage('reflux-versions', []),
    hf_versions: useLocalStorage('reflux-hf_versions', []),
    prompt: useLocalStorage('reflux-prompt', ''),
    aspect_ratio: useLocalStorage('reflux-aspect_ratio', '1:1'),
    num_outputs: useLocalStorage('reflux-num_outputs', 1),
    lora_scale: useLocalStorage('reflux-lora_scale', 1),
    num_inference_steps: useLocalStorage('reflux-num_inference_steps', 28),
    model: useLocalStorage('reflux-model', 'dev'),
    guidance_scale: useLocalStorage('reflux-guidance_scale', 3.5),
    seed: useLocalStorage('reflux-seed', null),
    output_format: useLocalStorage('reflux-output_format', 'webp'),
    output_quality: useLocalStorage('reflux-output_quality', 80),
    merge: useLocalStorage('reflux-merge', false)
  }),
  data: () => ({
    loading: false,
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
    ...mapState(useVersionStore, [
      'getOwnerNameByVersion',
      'getTriggerByVersion'
    ]),
    trigger_words() {
      return this.versions.map((version) => ({
        version,
        name: this.getOwnerNameByVersion(version),
        word: this.getTriggerByVersion(version)
      }))
    }
  },
  methods: {
    ...mapActions(usePredictionStore, ['createBatch']),
    async submit() {
      this.loading = true
      try {
        await this.createBatch({
          versions: this.versions,
          hf_versions: this.hf_versions,
          num_outputs: this.num_outputs,
          merge: this.merge,
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
