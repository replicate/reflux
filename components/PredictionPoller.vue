<template lang="pug"></template>

<script>
import { mapState, mapActions } from 'pinia'
import { usePredictionStore } from '~/stores/prediction'

const POLL_INTERVAL = 2000

export default {
  name: 'PredictionPoller',
  data: () => ({
    interval: null
  }),
  computed: mapState(usePredictionStore, ['incompleteOutputs']),
  methods: {
    ...mapActions(usePredictionStore, ['pollPrediction']),
    clearInterval() {
      if (this.interval) {
        clearInterval(this.interval)
        this.interval = null
      }
    },
    pollAllIncompleteOutputs() {
      this.incompleteOutputs.forEach((output) => this.pollPrediction(output.id))
    }
  },
  watch: {
    incompleteOutputs: {
      immediate: true,
      deep: true,
      handler(incompleteOutputs) {
        if (incompleteOutputs.length <= 0) {
          this.clearInterval()
          return
        }

        if (!this.interval) {
          this.interval = setInterval(
            this.pollAllIncompleteOutputs,
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
