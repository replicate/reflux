<template lang="pug">
.flex.flex-row.items-center.w-full.h-14.border-b
  .flex.items-center.w-80.px-2.font-thin.text-3xl
    a(
      href="https://replicate.com/?utm_source=project&utm_campaign=reflux"
      target="_new"
    )
      img.h-8.pl-1.py-1.pr-3.mr-3.border-r(
        src="/replicate-logo.svg"
      )
    span.animate-text
      | Re
      span.plicate plicate
      span.font-medium.inline-block
        | Flux
        u-badge.mx-1.mt-1.float-right(
          class="-rotate-6"
          color="red"
          variant="solid"
        ) Beta

  //- Control buttons
  .flex-grow.flex.gap-2
    u-button(
      @click="tool = 'V'"
      :color="tool === 'V' ? 'black' : 'white'"
      icon="i-heroicons-cursor-arrow-rays"
      size="xs"
    )
      | Pointer
      u-kbd.ml-1 V
    u-button(
      @click="tool = 'H'"
      :color="tool === 'H' ? 'black' : 'white'"
      icon="i-heroicons-hand-raised"
      size="xs"
    )
      | Drag
      u-kbd.ml-1 H
    u-button(
      v-if="false"
      @click=""
      color="white"
      icon="i-heroicons-pencil"
      size="xs"
    )
      | Sketch
      u-kbd.ml-1 S
    u-button(
      v-if="false"
      @click=""
      color="white"
      icon="i-heroicons-chat-bubble-bottom-center-text"
      size="xs"
    )
      | Text
      u-kbd.ml-1 T

  //- Right hand stuff
  .flex.gap-2.px-2
    .text-sm.font-light.content-center
      | Replicate 
      a.underline.underline-offset-4(
        class="decoration-[0.5px] hover:decoration-2"
        href="https://replicate.com/account/api-tokens"
        target="_new"
      ) API token
      | :
    u-input.w-64(
      v-model="replicate_api_token"
      type="password"
      icon="i-heroicons-key"
      placeholder="Replicate API token..."
      trailing
    )
    u-button(
      @click="openCode"
      color="white"
      icon="i-heroicons-code-bracket"
      size="xs"
    ) Code
</template>

<script>
import { useLocalStorage, onKeyStroke } from '@vueuse/core'

export default {
  name: 'UiTopPanel',
  setup: () => {
    const tool = useLocalStorage('reflux-tool', 'V')

    onKeyStroke(['v', 'V'], (e) => {
      e.preventDefault()
      tool.value = 'V'
    })

    onKeyStroke(['h', 'H'], (e) => {
      e.preventDefault()
      tool.value = 'H'
    })

    return {
      tool,
      replicate_api_token: useLocalStorage('reflux-replicate-api-token', null)
    }
  },
  methods: {
    openCode() {
      window.open('https://github.com/replicate/reflux', '_blank').focus()
    }
  }
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
