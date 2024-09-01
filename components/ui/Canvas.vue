<template lang="pug">
.canvas-container.overscroll-x-none(
  :class="containerClasses"
  @mousedown="handleMouseDown"
  @mousemove="handleMouseMove"
  @mouseup="handleMouseUp"
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
      :class="{ 'pointer-events-none': tool === 'H' }"
      @mousedown.stop="startSelection"
      :data-id="output.id"
    )
      u-tooltip(:text="output.metadata.name || 'Flux'")
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
  .selection-box(v-if="isSelecting" :style="selectionBoxStyle")
  .selection-bounding-box(
    v-if="selectedImages.length > 1"
    :style="selectedImagesBoundingBox"
  )
</template>

<script>
import { mapState, mapActions } from 'pinia'
import { useLocalStorage, onKeyStroke } from '@vueuse/core'

export default {
  name: 'UiCanvas',
  setup() {
    const predictionStore = usePredictionStore()
    const outputs = shallowRef(predictionStore.outputs)

    const tool = useLocalStorage('reflux-tool', 'V')
    const canvasState = useLocalStorage('reflux-canvas-state', {
      scale: 1,
      offsetX: 0,
      offsetY: 0
    })

    onKeyStroke(['v', 'V'], (e) => {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault()
        tool.value = 'V'
      }
    })

    onKeyStroke(['h', 'H'], (e) => {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault()
        tool.value = 'H'
      }
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
      canvasState,
      tool
    }
  },
  data() {
    return {
      scale: this.canvasState.scale,
      offsetX: this.canvasState.offsetX,
      offsetY: this.canvasState.offsetY,
      isDragging: false,
      draggingBoundingBox: false,
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
      slideover_open: false,
      isSelecting: false,
      selectionStart: { x: 0, y: 0 },
      selectionEnd: { x: 0, y: 0 },
      selectedImages: []
    }
  },
  computed: {
    ...mapState(usePredictionStore, ['outputs']),
    containerClasses() {
      return {
        'cursor-default': this.tool === 'V',
        'cursor-grab': this.tool === 'H' && !this.isDragging,
        'cursor-grabbing': this.tool === 'H' && this.isDragging
      }
    },
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
    },
    selectionBoxStyle() {
      const left = Math.min(this.selectionStart.x, this.selectionEnd.x)
      const top = Math.min(this.selectionStart.y, this.selectionEnd.y)
      const width = Math.abs(this.selectionEnd.x - this.selectionStart.x)
      const height = Math.abs(this.selectionEnd.y - this.selectionStart.y)
      return {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`
      }
    },
    selectedImagesBoundingBox() {
      if (this.selectedImages.length === 0) return null

      const containerRect = this.$el.getBoundingClientRect()
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      this.selectedImages.forEach((image) => {
        const { x, y, width, height } = image.metadata
        const snappedX = Math.round(x / this.dotSpacing) * this.dotSpacing
        const snappedY = Math.round(y / this.dotSpacing) * this.dotSpacing
        const scaledX = snappedX * this.scale + this.offsetX * this.scale
        const scaledY = snappedY * this.scale + this.offsetY * this.scale
        const scaledWidth = width * this.scale
        const scaledHeight = height * this.scale

        minX = Math.min(minX, scaledX)
        minY = Math.min(minY, scaledY)
        maxX = Math.max(maxX, scaledX + scaledWidth)
        maxY = Math.max(maxY, scaledY + scaledHeight)
      })

      return {
        left: `${minX + containerRect.left}px`,
        top: `${minY + containerRect.top}px`,
        width: `${maxX - minX}px`,
        height: `${maxY - minY}px`
      }
    }
  },
  methods: {
    ...mapActions(usePredictionStore, ['updateOutputPosition', 'removeOutput']),
    handleKeyDown(e) {
      if (
        e.key === 'Backspace' &&
        this.selectedImages.length > 0 &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
      ) {
        e.preventDefault()
        this.deleteSelectedImages()
      }
    },
    handleMouseDown(e) {
      if (this.tool === 'V') {
        this.startSelection(e)
      } else if (this.tool === 'H') {
        this.startDrag(e)
      }
    },
    handleMouseMove(e) {
      if (this.tool === 'V') {
        this.updateSelection(e)
      } else if (this.tool === 'H' && this.isDragging) {
        this.drag(e)
      }
    },
    handleMouseUp(e) {
      if (this.tool === 'V') {
        this.endSelection()
      } else if (this.tool === 'H') {
        this.stopDrag()
      }
    },
    handleWheel(e) {
      if (e.ctrlKey) {
        // Pinch zoom on trackpad
        this.zoom(e)
      } else {
        // Pan in both modes
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
    startSelection(e) {
      if (this.tool !== 'V') return

      const boundingBox = this.$el.querySelector('.selection-bounding-box')
      if (boundingBox && boundingBox.contains(e.target)) {
        this.draggingBoundingBox = true
        this.startImageDrag(this.selectedImages[0], e)
      } else if (e.target.closest('.image')) {
        const output = this.outputs.find(
          (o) => o.id === e.target.closest('.image').dataset.id
        )
        if (e.ctrlKey || e.metaKey) {
          // Toggle selection
          const index = this.selectedImages.findIndex(
            (img) => img.id === output.id
          )
          if (index === -1) {
            this.selectedImages.push(output)
          } else {
            this.selectedImages.splice(index, 1)
          }
        } else {
          // Start dragging the image(s)
          if (!this.selectedImages.some((img) => img.id === output.id)) {
            this.selectedImages = [output]
          }
          this.startImageDrag(output, e)
        }
      } else {
        // Start selection box
        this.isSelecting = true
        this.selectionStart = { x: e.clientX, y: e.clientY }
        this.selectionEnd = { x: e.clientX, y: e.clientY }
        if (!e.ctrlKey && !e.metaKey) {
          this.selectedImages = []
        }
      }
    },
    updateSelection(e) {
      if (this.isSelecting) {
        this.selectionEnd = { x: e.clientX, y: e.clientY }
        this.updateSelectedImages()
      } else if (this.draggingImage || this.draggingBoundingBox) {
        this.drag(e)
      }
    },
    updateSelectedImages() {
      const left = Math.min(this.selectionStart.x, this.selectionEnd.x)
      const top = Math.min(this.selectionStart.y, this.selectionEnd.y)
      const right = Math.max(this.selectionStart.x, this.selectionEnd.x)
      const bottom = Math.max(this.selectionStart.y, this.selectionEnd.y)

      this.selectedImages = this.outputs.filter((output) => {
        const rect = this.$el
          .querySelector(`[data-id="${output.id}"]`)
          .getBoundingClientRect()
        return (
          rect.left < right &&
          rect.right > left &&
          rect.top < bottom &&
          rect.bottom > top
        )
      })
    },
    endSelection() {
      if (this.isSelecting) {
        this.isSelecting = false
      }
      this.stopDrag()
      this.draggingBoundingBox = false
    },
    startDrag(e) {
      this.isDragging = true
      this.lastX = e.clientX
      this.lastY = e.clientY
    },
    startImageDrag(output, event) {
      this.draggingImage = output
      const canvasRect = this.$el.getBoundingClientRect()
      this.imageOffsetX =
        event.clientX -
        (output.metadata.x * this.scale +
          this.offsetX * this.scale +
          canvasRect.left)
      this.imageOffsetY =
        event.clientY -
        (output.metadata.y * this.scale +
          this.offsetY * this.scale +
          canvasRect.top)
      event.preventDefault()
    },
    stopDrag() {
      this.isDragging = false
      this.draggingImage = null
    },
    drag(e) {
      if (this.tool === 'H' && this.isDragging) {
        const dx = (e.clientX - this.lastX) / this.scale
        const dy = (e.clientY - this.lastY) / this.scale
        this.offsetX += dx
        this.offsetY += dy
        this.lastX = e.clientX
        this.lastY = e.clientY

        this.canvasState.offsetX = this.offsetX
        this.canvasState.offsetY = this.offsetY
      } else if (this.draggingImage || this.draggingBoundingBox) {
        const canvasRect = this.$el.getBoundingClientRect()
        let newX =
          (e.clientX - this.imageOffsetX - canvasRect.left) / this.scale -
          this.offsetX
        let newY =
          (e.clientY - this.imageOffsetY - canvasRect.top) / this.scale -
          this.offsetY

        // Snap to grid
        newX = Math.round(newX / this.dotSpacing) * this.dotSpacing
        newY = Math.round(newY / this.dotSpacing) * this.dotSpacing

        const dx = newX - this.draggingImage.metadata.x
        const dy = newY - this.draggingImage.metadata.y

        this.selectedImages.forEach((image) => {
          const updatedX = image.metadata.x + dx
          const updatedY = image.metadata.y + dy

          // Update the position in the store
          this.updateOutputPosition({
            id: image.id,
            x: updatedX,
            y: updatedY
          })

          // Update the position locally
          image.metadata.x = updatedX
          image.metadata.y = updatedY
        })
      }
    },
    zoom(e) {
      e.preventDefault()
      const zoomFactor = 0.01
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
    pan(e) {
      const dx = e.deltaX / this.scale
      const dy = e.deltaY / this.scale
      this.offsetX -= dx
      this.offsetY -= dy

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
      const aspectRatio = output.input?.aspect_ratio || '1:1' // Default to 1:1 if aspect_ratio is not available
      const [width, height] = this.getImageDimensions(aspectRatio)
      const snappedX =
        Math.round(output.metadata.x / this.dotSpacing) * this.dotSpacing
      const snappedY =
        Math.round(output.metadata.y / this.dotSpacing) * this.dotSpacing
      const isSelected = this.selectedImages.some((img) => img.id === output.id)
      const borderWidth = 1 // This should match the border width in the style

      return {
        position: 'absolute',
        left: `${snappedX}px`,
        top: `${snappedY}px`,
        width: `${width}px`,
        height: `${height}px`,
        // cursor: this.tool === 'V' ? 'move' : 'auto',
        outline: isSelected ? `${borderWidth}px solid #ebb305` : 'none'
      }
    },
    getImageDimensions(aspectRatio) {
      const [width, height] = aspectRatio.split(':').map(Number)
      const baseSize = 300 // Adjust this value to change the overall size of the images
      return [baseSize * (width / height), baseSize]
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
    deleteSelectedImages() {
      this.selectedImages.forEach((image) => {
        this.removeOutput(image.id)
      })
      this.selectedImages = []
    }
  },
  mounted() {
    window.addEventListener('keydown', this.handleKeyDown)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown)
  }
}
</script>

<style lang="stylus" scoped>
.canvas-container
  width 100%
  height 100%
  overflow hidden
  background #f8f8f8

  .canvas
    width 100%
    height 100%
    transform-origin 0 0

  .image
    position absolute
    user-select none

    .inline-flex
      display block !important
      height 100%

    &:hover
      outline 1px solid #ebb305 !important

      :deep(.buttons)
        display flex

    :deep(.buttons)
      display none

    :deep(img)
      width 100%
      height 100%
      object-fit cover

.dot-group
  position absolute

.selection-box
  position absolute
  border 1px solid #ebb305
  background-color rgba(235, 179, 5, 0.1)
  pointer-events none

.selection-bounding-box
  position absolute
  outline 1px solid #ebb305
  pointer-events auto
  z-index 10

.canvas-container[class*='cursor-grab']
  .image
    &:hover
      :deep(.buttons)
        display none
</style>
