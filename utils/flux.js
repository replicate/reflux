import { useLocalStorage } from '@vueuse/core'

class Flux {
  constructor() {
    this.version_options = useLocalStorage('reflux-version-options', [])
  }

  getNameByVersion(version) {
    const item = this.version_options.value.find((i) => i.version === version)
    return item ? item.name : null
  }

  getVersionByName(name) {
    const item = this.version_options.value.find((i) => i.name === name)
    return item ? item.version : null
  }

  getTriggerByVersion(version) {
    const item = this.version_options.value.find((i) => i.version === version)
    return item ? item.trigger : null
  }

  setVersionOptions(val) {
    this.version_options.value = val
  }
}

const flux = new Flux()

export default flux
