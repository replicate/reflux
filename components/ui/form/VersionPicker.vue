<template lang="pug">
div

  u-button(
    @click="is_open = true"
    color="white"
    block
  )
    | Add
    u-kbd {{ metaSymbol }} F

  u-modal(
    v-model="is_open"
    :ui="{ width: 'w-full sm:max-w-4xl', height: 'h-dvh sm:h-[48rem]' }"
  )
    u-card.flex.flex-col.h-full(
      :ui="{ header: { padding: 'px-0 py-0 sm:px-0' }, body: { base: 'flex-grow overflow-y-auto' } }"
    )
      template(#header)
        u-input.py-1(
          v-model="query"
          placeholder="Search..."
          icon="i-heroicons-magnifying-glass"
          variant="none"
          size="xl"
        )
        u-divider
        .px-6.py-3
          u-button.mr-3(
            @click="search_filter = 'replicate'"
            :color="search_filter === 'replicate' ? 'primary' : 'white'"
            label="On Replicate"
            size="md"
          )
          u-button(
            @click="search_filter = 'owner'"
            :color="search_filter === 'owner' ? 'primary' : 'white'"
            label="Your own"
            size="md"
          )

      .grid.grid-cols-4.gap-3
        .cursor-pointer.break-all.p-3(
          v-for="(version, i) in results"
          :key="`version-${i}`"
          :class="versions.includes(version.version) ? 'bg-[#ebb305]' : 'hover:bg-[#f8f8f8]'"
          @click="onClick(version.version)"
        )
          img.aspect-1.object-cover.mb-2(:src="version?.cover_image_url || '/replicate-logo.svg'")
          .text-sm.font-bold {{ version.name }}
          .text-xs {{ version.owner }}
</template>

<script>
import { useLocalStorage, onKeyStroke } from '@vueuse/core'

export default {
  name: 'UiFormVersionPicker',
  setup: () => {
    const { metaSymbol } = useShortcuts()
    const is_open = ref(false)

    onKeyStroke(['f', 'F'], (e) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        is_open.value = true
      }
    })

    return {
      replicate_api_token: useLocalStorage('reflux-replicate-api-token', null),
      versions: useLocalStorage('reflux-versions', []),
      search_filter: useLocalStorage('reflux-search_filter', 'replicate'),

      metaSymbol,
      is_open
    }
  },
  data: () => ({
    version_options: flux.version_options,
    query: ''
  }),
  computed: {
    results() {
      const subset = this.version_options.filter(
        (version) => version.is_owner === (this.search_filter === 'owner')
      )

      if (!this.query.trim()) {
        return subset
      }

      const lowercaseQuery = this.query.toLowerCase().trim()
      return subset.filter((version) =>
        version.name.toLowerCase().includes(lowercaseQuery)
      )
    }
  },
  watch: {
    is_open: {
      async handler(is_open) {
        if (!is_open || !this.replicate_api_token) {
          return
        }

        try {
          const versions = await $fetch(
            `/api/search?token=${this.replicate_api_token}`
          )
          // Dedupe by version key and sort alphabetically by name
          const versionMap = new Map(versions.map((v) => [v.version, v]))
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
    onClick(version) {
      if (this.versions.includes(version)) {
        this.versions = this.versions.filter((v) => v !== version)
      } else {
        this.versions.push(version)
      }
    }
  }
}
</script>

<style lang="stylus" scoped></style>
