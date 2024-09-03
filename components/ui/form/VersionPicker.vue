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
          u-button(
            @click="search_filter = 'replicate'"
            :color="search_filter === 'replicate' ? 'primary' : 'white'"
            label="On Replicate"
            size="md"
          )
          u-button.mx-3(
            @click="search_filter = 'huggingface'"
            :color="search_filter === 'huggingface' ? 'primary' : 'white'"
            label="On Hugging Face"
            size="md"
          )
          u-button(
            @click="search_filter = 'owner'"
            :color="search_filter === 'owner' ? 'primary' : 'white'"
            label="Your own"
            size="md"
          )

      .grid.grid-cols-1.gap-3(
        v-if="search_filter === 'huggingface'"
      )
        u-form-group(
          label="Huggingface path, or URL to the LoRA weights."
          help="Ex: alvdansen/frosting_lane_flux"
          name="hf_versions"
        )
          .flex.gap-3
            u-input.flex-grow(
              v-model="hf_version"
              @keydown.enter="addVersion"
            )
            u-button(
              @click="addVersion"
              icon="i-heroicons-plus"
              color="white"
              trailing
            ) Add
        u-button.mr-2.mt-2(
          v-for="(version, i) in hf_versions"
          :key="`hf_version-${i}`"
          color="white"
          block
        )
          .flex-grow.text-left.font-light.break-all {{ version }}
          u-divider.mx-1.h-4(orientation="vertical")
          u-icon.w-4(
            @click.stop="hf_versions = hf_versions.filter((v) => v !== version)"
            name="i-heroicons-trash"
          )
      .grid.grid-cols-4.gap-3(v-else)
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
import { mapState, mapActions } from 'pinia'

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
      hf_versions: useLocalStorage('reflux-hf_versions', []),
      search_filter: useLocalStorage('reflux-search_filter', 'replicate'),

      metaSymbol,
      is_open
    }
  },
  data: () => ({
    query: '',
    hf_version: ''
  }),
  computed: {
    ...mapState(useVersionStore, ['version_options', 'getTriggerByVersion']),
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
    replicate_api_token: {
      immediate: true,
      async handler(token) {
        if (!token) {
          return
        }

        try {
          const versions = await $fetch(`/api/search?token=${token}`)
          // Dedupe by version key and sort alphabetically by name
          const versionMap = new Map(versions.map((v) => [v.version, v]))
          const version_options = Array.from(versionMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          )

          // Persist
          this.setVersionOptions(version_options)
        } catch (e) {
          console.log('--- (create) error:', e.message)
        }
      }
    }
  },
  methods: {
    ...mapActions(useVersionStore, ['setVersionOptions']),
    onClick(version) {
      if (this.versions.includes(version)) {
        this.versions = this.versions.filter((v) => v !== version)
      } else {
        this.versions.push(version)
      }
    },
    addVersion() {
      if (!this.hf_version) {
        return
      }

      this.hf_versions.push(this.hf_version)
      this.hf_version = null
    }
  }
}
</script>

<style lang="stylus" scoped></style>
