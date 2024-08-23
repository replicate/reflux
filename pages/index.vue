<template lang="pug">
.flex.flex-col.h-screen
  ui-top-panel
  .flex.flex-1.overflow-hidden
    ui-left-panel
    ui-canvas
    prediction-poller
</template>

<script>
export default {
  name: 'index'
}
</script>

<style lang="stylus" scoped></style>
