<template lang="pug"></template>

<script>
import { mapState, mapActions } from 'pinia'
import { usePredictionStore } from '~/stores/prediction'

const POLL_INTERVAL = 3000

export default {
  name: 'PredictionPoller',
  data: () => ({
    interval: null
  }),
  computed: mapState(usePredictionStore, ['incompletePredictions']),
  methods: {
    ...mapActions(usePredictionStore, ['pollIncompletePredictions']),
    clearInterval() {
      if (this.interval) {
        clearInterval(this.interval)
        this.interval = null
      }
    }
  },
  watch: {
    incompletePredictions: {
      immediate: true,
      handler(incompletePredictions) {
        if (incompletePredictions.length <= 0) {
          this.clearInterval()
          return
        }

        if (!this.interval) {
          this.interval = setInterval(
            this.pollIncompletePredictions,
            POLL_INTERVAL
          )
        }
      }
    }
  },
  beforeDestroy() {
    this.clearinterval()
  }
}
</script>
