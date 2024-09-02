export const useVersionStore = defineStore('versionStore', {
  state: () => ({
    version_options: []
  }),
  actions: {
    setVersionOptions(val) {
      this.version_options = val
    }
  },
  getters: {
    getOwnerNameByVersion: (state) => (version) => {
      const item = state.version_options.find((i) => i.version === version)
      return item ? `${item.owner}/${item.name}` : null
    },
    getVersionByName: (state) => (name) => {
      const item = state.version_options.find((i) => i.name === name)
      return item ? item.version : null
    },
    getTriggerByVersion: (state) => (version) => {
      const item = state.version_options.find((i) => i.version === version)
      return item ? item.trigger : null
    }
  }
})
