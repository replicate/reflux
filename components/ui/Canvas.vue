<template lang="pug">
.canvas-container(
  @mousedown="startDrag"
  @mouseup="stopDrag"
  @mousemove="drag"
  @wheel="handleWheel"
  @touchstart="handleTouchStart"
  @touchmove="handleTouchMove"
  @touchend="handleTouchEnd"
)
  .canvas(:style="canvasStyle")
    .dot-group(
      v-for="group in visibleDotGroups"
      :key="group.id"
      :style="dotGroupStyle(group)"
    )
    .image(
      v-for="output in outputs"
      :key="output.id"
      :style="imageStyle(output)"
      @mousedown.stop="startImageDrag(output, $event)"
    )
      u-tooltip(:text="output.metadata.name")
        template(v-if="output.status === 'succeeded'")
          img(
            v-if="output.output && output.output[0]"
            v-show="loadedImages[output.id]"
            @load="onImageLoad(output.id)"
            :src="output.output[0]"
            :alt="output.input.prompt"
          )
          u-skeleton.w-full.h-full.border(
            v-show="!loadedImages[output.id] || !output.output || !output.output[0]"
            :ui="{ rounded: 'rounded-none' }"
          )
          .buttons.absolute.top-2.right-2.flex.gap-x-2
            u-button(
              @click.stop="downloadImage(output)"
              icon="i-heroicons-folder-arrow-down"
              color="white"
              size="xs"
              square
              :disabled="!output.output || !output.output[0]"
            )
            u-button(
              @click.stop="removeOutput(output.id)"
              icon="i-heroicons-trash"
              color="white"
              size="xs"
              square
            )
        template(v-else-if="output.status === 'failed'")
          .bg-red-100.border.border-red-200.w-full.h-full.flex.items-center.justify-center.text-center.text-red-500
            .buttons.absolute.top-2.right-2.flex.gap-x-2
              u-button(
                @click.stop="removeOutput(output.id)"
                icon="i-heroicons-trash"
                color="white"
                size="xs"
                square
              )
            span Error: {{ output.error || 'Unknown' }}
        u-skeleton.w-full.h-full.border(
          v-else
          :ui="{ rounded: 'rounded-none' }"
        )
</template>

<script>
import { mapState, mapActions } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export default {
  name: 'UiCanvas',
  setup() {
    const predictionStore = usePredictionStore()
    const outputs = shallowRef(predictionStore.outputs)

    const canvasState = useLocalStorage('reflux-canvas-state', {
      scale: 1,
      offsetX: 0,
      offsetY: 0
    })

    const updateOutputs = () => {
      outputs.value = [...predictionStore.outputs]
    }

    onMounted(() => {
      predictionStore.$subscribe(updateOutputs)
    })

    onUnmounted(() => {
      predictionStore.$unsubscribe(updateOutputs)
    })

    return {
      outputs,
      canvasState
    }
  },
  data() {
    return {
      scale: this.canvasState.scale,
      offsetX: this.canvasState.offsetX,
      offsetY: this.canvasState.offsetY,
      isDragging: false,
      lastTouchDistance: null,
      lastX: 0,
      lastY: 0,
      dotSize: 2,
      dotSpacing: 20,
      minZoom: 0.4,
      maxZoom: 8,
      draggingImage: null,
      imageOffsetX: 0,
      imageOffsetY: 0,
      loadedImages: {},
      slideover_open: false
    }
  },
  computed: {
    ...mapState(usePredictionStore, ['outputs']),
    canvasStyle() {
      return {
        transform: `scale(${this.scale}) translate(${this.offsetX}px, ${this.offsetY}px)`
      }
    },
    visibleDotGroups() {
      const groups = []
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Calculate the visible area in the canvas coordinate system
      const visibleLeft = -this.offsetX
      const visibleTop = -this.offsetY
      const visibleRight = visibleLeft + viewportWidth / this.scale
      const visibleBottom = visibleTop + viewportHeight / this.scale

      // Calculate the range of dot groups to render with a fixed buffer
      const buffer = 2 * this.dotSpacing
      const groupSize = 20 // Number of dots in each direction for a group
      const startX = Math.floor(
        (visibleLeft - buffer) / (this.dotSpacing * groupSize)
      )
      const startY = Math.floor(
        (visibleTop - buffer) / (this.dotSpacing * groupSize)
      )
      const endX = Math.ceil(
        (visibleRight + buffer) / (this.dotSpacing * groupSize)
      )
      const endY = Math.ceil(
        (visibleBottom + buffer) / (this.dotSpacing * groupSize)
      )

      for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
          groups.push({ id: `${x}-${y}`, x, y })
        }
      }
      return groups
    }
  },
  methods: {
    ...mapActions(usePredictionStore, ['updateOutputPosition', 'removeOutput']),
    startDrag(e) {
      this.isDragging = true
      this.lastX = e.clientX
      this.lastY = e.clientY
    },
    stopDrag() {
      this.isDragging = false
      this.draggingImage = null
    },
    drag(e) {
      if (this.isDragging) {
        const dx = (e.clientX - this.lastX) / this.scale
        const dy = (e.clientY - this.lastY) / this.scale
        this.offsetX += dx
        this.offsetY += dy
        this.lastX = e.clientX
        this.lastY = e.clientY
      } else if (this.draggingImage) {
        const canvasRect = this.$el.getBoundingClientRect()
        let newX =
          (e.clientX - canvasRect.left - this.imageOffsetX) / this.scale -
          this.offsetX
        let newY =
          (e.clientY - canvasRect.top - this.imageOffsetY) / this.scale -
          this.offsetY

        // Snap to grid
        newX = Math.round(newX / this.dotSpacing) * this.dotSpacing
        newY = Math.round(newY / this.dotSpacing) * this.dotSpacing

        // Update the position in the store
        this.updateOutputPosition({
          id: this.draggingImage.id,
          x: newX,
          y: newY
        })

        // Update the position locally
        this.draggingImage.metadata.x = newX
        this.draggingImage.metadata.y = newY

        this.canvasState.offsetX = this.offsetX
        this.canvasState.offsetY = this.offsetY
      }
    },
    zoom(e) {
      e.preventDefault()
      const zoomFactor = 0.02
      const direction = e.deltaY > 0 ? -1 : 1
      const newScale = this.scale * (1 + direction * zoomFactor)

      // Apply min/max zoom constraints
      const constrainedScale = Math.min(
        Math.max(newScale, this.minZoom),
        this.maxZoom
      )

      if (constrainedScale === this.scale) return // No change in zoom level

      const mouseX = e.clientX || e.touches[0].clientX
      const mouseY = e.clientY || e.touches[0].clientY
      const containerRect = e.currentTarget.getBoundingClientRect()
      const mouseXRelative = mouseX - containerRect.left
      const mouseYRelative = mouseY - containerRect.top

      const scaleChange = constrainedScale / this.scale
      this.offsetX -= (mouseXRelative / this.scale) * (scaleChange - 1)
      this.offsetY -= (mouseYRelative / this.scale) * (scaleChange - 1)

      this.scale = constrainedScale

      this.canvasState.scale = this.scale
      this.canvasState.offsetX = this.offsetX
      this.canvasState.offsetY = this.offsetY
    },
    dotGroupStyle(group) {
      const size = this.dotSize / this.scale
      const groupSize = 20 // Same as in visibleDotGroups
      const groupWidth = this.dotSpacing * groupSize
      return {
        position: 'absolute',
        left: `${group.x * groupWidth}px`,
        top: `${group.y * groupWidth}px`,
        width: `${groupWidth}px`,
        height: `${groupWidth}px`,
        backgroundImage: `radial-gradient(circle at center, #aaa ${
          size / 2
        }px, transparent ${size / 2}px)`,
        backgroundSize: `${this.dotSpacing}px ${this.dotSpacing}px`,
        backgroundPosition: '0 0',
        backgroundRepeat: 'repeat'
      }
    },
    onImageLoad(id) {
      this.loadedImages[id] = true
    },
    imageStyle(output) {
      const [width, height] = this.getImageDimensions(output.input.aspect_ratio)
      const snappedX =
        Math.round(output.metadata.x / this.dotSpacing) * this.dotSpacing
      const snappedY =
        Math.round(output.metadata.y / this.dotSpacing) * this.dotSpacing
      return {
        position: 'absolute',
        left: `${snappedX}px`,
        top: `${snappedY}px`,
        width: `${width}px`,
        height: `${height}px`,
        cursor: 'move'
      }
    },
    getImageDimensions(aspectRatio) {
      const [width, height] = aspectRatio.split(':').map(Number)
      const baseSize = 300 // Adjust this value to change the overall size of the images
      return [baseSize * (width / height), baseSize]
    },
    startImageDrag(output, event) {
      this.draggingImage = output
      const rect = event.target.getBoundingClientRect()
      this.imageOffsetX = event.clientX - rect.left
      this.imageOffsetY = event.clientY - rect.top
      event.preventDefault()
    },
    downloadImage(output) {
      if (output.output && output.output[0]) {
        const link = document.createElement('a')
        link.href = output.output[0]
        link.download = `${output.metadata.name.replace(/\s+/g, '_')}_${
          output.id
        }.${output.input.output_format || 'png'}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    },
    handleWheel(e) {
      if (e.ctrlKey) {
        // Pinch zoom on trackpad
        this.zoom(e)
      } else {
        // Normal wheel event (scroll)
        this.pan(e)
      }
    },
    handleTouchStart(e) {
      if (e.touches.length === 2) {
        // Two-finger touch
        this.lastTouchDistance = this.getTouchDistance(e.touches)
      } else {
        // Single touch (treat as drag start)
        this.startDrag(e.touches[0])
      }
    },
    handleTouchMove(e) {
      if (e.touches.length === 2) {
        // Two-finger touch
        const currentDistance = this.getTouchDistance(e.touches)
        const scaleFactor = currentDistance / this.lastTouchDistance
        this.zoom({
          deltaY: scaleFactor > 1 ? -1 : 1,
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY
        })
        this.lastTouchDistance = currentDistance
      } else if (this.isDragging) {
        // Single touch (treat as drag)
        this.drag(e.touches[0])
      }
    },
    handleTouchEnd() {
      this.stopDrag()
      this.lastTouchDistance = null
    },
    getTouchDistance(touches) {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      )
    },
    pan(e) {
      const dx = e.deltaX / this.scale
      const dy = e.deltaY / this.scale
      this.offsetX -= dx
      this.offsetY -= dy

      this.canvasState.offsetX = this.offsetX
      this.canvasState.offsetY = this.offsetY
    }
  }
}
</script>

<style lang="stylus" scoped>
.canvas-container
  width: 100%
  height: 100%
  overflow: hidden
  cursor: move

  .canvas
    width: 100%
    height: 100%
    transform-origin: 0 0

  .image
    position: absolute
    user-select: none

    .inline-flex
      display block !important
      height 100%

    &:hover
      :deep(.buttons)
        display flex

    :deep(.buttons)
      display none

    :deep(img)
      width: 100%
      height: 100%
      object-fit: cover

.dot-group
  position: absolute
</style>
