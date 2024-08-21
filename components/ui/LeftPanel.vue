<template lang="pug">
.flex-shrink-0.w-80.border-r
  .p-2
    u-tabs(:items="tab_items")
      template(#create="{ item }")
        ui-form-create
      template(#finetune="{ item }")
        b FINETUNE
</template>

<script>
export default {
  name: 'UiLeftPanel',
  data: () => ({
    tab_items: [
      {
        label: 'Create',
        icon: 'i-heroicons-paint-brush',
        slot: 'create'
      }
      /*
      {
        label: 'Finetune',
        icon: 'i-heroicons-cog-6-tooth',
        slot: 'finetune'
      }
      */
    ]
  })
}
</script>

<style lang="stylus" scoped></style>
