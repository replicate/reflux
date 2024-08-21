<template lang="pug">
.flex.flex-row.items-center.w-full.h-14.border-b.px-2
  .flex-grow.flex.items-center.font-thin.text-3xl
    img.h-8.pl-1.py-1.pr-3.mr-3.border-r(
      src="/replicate-logo.svg"
    )
    span.animate-text
      | Re
      span.plicate plicate
      span.font-medium Flux
  u-input.w-64(
    v-model="replicate_api_token"
    type="password"
    icon="i-heroicons-key"
    placeholder="Replicate API token..."
    trailing
  )
</template>

<script>
import { useLocalStorage } from '@vueuse/core'

export default {
  name: 'UiTopPanel',
  setup: () => ({
    replicate_api_token: useLocalStorage('reflux-replicate-api-token', null)
  })
}
</script>

<style lang="stylus" scoped>
.animate-text
  display inline-block
  overflow hidden

  .plicate
    display inline-block
    animation collapse-fade 2s ease-in-out forwards

@keyframes collapse-fade
  0%, 50%
    max-width 100%
    opacity 1
  100%
    max-width 0
    opacity 0
</style>
