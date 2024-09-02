<template lang="pug">
.w-full.height-full.overflow-hidden(@contextmenu.prevent="onContextMenu")
  #canvas(
    :style="containerStyles"
    ref="canvas"
  )
  u-context-menu(
    v-model="isContextMenuOpen"
    :virtual-element="virtualElement"
    :ui="{ transition: { enterActiveClass: 'transition-none', enterFromClass: 'transition-none', enterToClass: 'transition-none', leaveActiveClass: 'transition-none', leaveFromClass: 'transition-none', leaveToClass: 'transition-none' } }"
  )
    u-vertical-navigation(
      :links="contextMenuLinks"
      :ui="{ size: 'text-xs', font: 'font-normal' }"
    )
</template>

<script>
import Konva from 'konva'
import { useLocalStorage, useMouse, useWindowScroll } from '@vueuse/core'
import { mapState, mapActions } from 'pinia'

const BORDER_WIDTH = 1

export default {
  name: 'UiCanvas',
  setup() {
    const tool = useLocalStorage('reflux-tool', 'V')
    const canvasState = useLocalStorage('reflux-canvas-state-test', {
      stagePosition: { x: 0, y: 0 },
      stageScale: { x: 1, y: 1 }
    })

    const moveTransformerNodesRef = ref(() => {})
    const copyTransformerNodesRef = ref(() => {})
    const copyTransformerNodesUrlRef = ref(() => {})
    const pasteTransformerNodesRef = ref(() => {})
    const deleteTransformerNodesRef = ref(() => {})
    const downloadTransformerNodesRef = ref(() => {})

    // Add keypress handler
    onKeyStroke('Backspace', (e) => {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault()
        deleteTransformerNodesRef.value()
      }
    })
    useEventListener(document, 'keydown', (e) => {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (e.key === ']' || e.key === '}') {
          e.preventDefault()
          moveTransformerNodesRef.value('up', e.shiftKey)
        } else if (e.key === '[' || e.key === '{') {
          e.preventDefault()
          moveTransformerNodesRef.value('down', e.shiftKey)
        } else if (e.key === 'c' && e.metaKey) {
          e.preventDefault()
          if (e.shiftKey) {
            copyTransformerNodesUrlRef.value()
          } else {
            copyTransformerNodesRef.value()
          }
        } else if (e.key === 'x' && e.metaKey) {
          e.preventDefault()
          copyTransformerNodesRef.value(true)
        } else if (e.key === 'v' && e.metaKey) {
          e.preventDefault()
          pasteTransformerNodesRef.value()
        } else if (e.key === 's' && e.metaKey && e.shiftKey) {
          e.preventDefault()
          downloadTransformerNodesRef.value()
        }
      }
    })

    // Setup context menu
    const { x, y } = useMouse()
    const { y: windowY } = useWindowScroll()

    const { metaSymbol } = useShortcuts()
    const isContextMenuOpen = ref(false)
    const virtualElement = ref({ getBoundingClientRect: () => ({}) })

    function onContextMenu(e) {
      const top = unref(y) - unref(windowY)
      const left = unref(x)

      virtualElement.value.getBoundingClientRect = () => ({
        width: 0,
        height: 0,
        top,
        left
      })

      isContextMenuOpen.value = true
    }

    return {
      tool,
      canvasState,

      moveTransformerNodesRef,
      copyTransformerNodesRef,
      copyTransformerNodesUrlRef,
      pasteTransformerNodesRef,
      deleteTransformerNodesRef,
      downloadTransformerNodesRef,

      metaSymbol,
      virtualElement,
      onContextMenu,
      isContextMenuOpen
    }
  },
  data: () => ({
    stage: null,
    layer: null,
    transformer: null,

    isDragging: false,
    selection: {
      layer: null,
      startPos: null,
      rect: null,
      nodes: []
    },
    clipboard: null
  }),
  computed: {
    ...mapState(usePredictionStore, ['outputs']),
    containerStyles() {
      return {
        cursor:
          this.tool === 'V' ? 'default' : this.isDragging ? 'grabbing' : 'grab'
      }
    },
    contextMenuLinks() {
      const manipulationLinks = [
        {
          label: 'Paste',
          badge: `${this.metaSymbol} V`,
          click: () => {
            this.pasteTransformerNodes()
            this.isContextMenuOpen = false
          }
        }
      ]
      const copyLinks = []
      const movementLinks = []
      const downloadLinks = []

      if (this.selection.nodes.length > 0) {
        manipulationLinks.push(
          {
            label: 'Cut',
            badge: `${this.metaSymbol} X`,
            click: () => {
              this.copyTransformerNodes(true)
              this.isContextMenuOpen = false
            }
          },
          {
            label: 'Copy',
            badge: `${this.metaSymbol} C`,
            click: () => {
              this.copyTransformerNodes()
              this.isContextMenuOpen = false
            }
          },
          {
            label: 'Delete',
            badge: '⌫',
            click: () => {
              this.deleteTransformerNodes()
              this.isContextMenuOpen = false
            }
          }
        )

        copyLinks.push({
          label: 'Copy Link',
          badge: `${this.metaSymbol} ⇧ C`,
          disabled: this.selection.nodes.length !== 1,
          click: () => {
            this.copyTransformerNodesUrl()
            this.isContextMenuOpen = false
          }
        })

        movementLinks.push(
          {
            label: 'Move Forward',
            badge: ']',
            click: () => {
              this.moveTransformerNodes('up', false)
              this.isContextMenuOpen = false
            }
          },
          {
            label: 'Send Backward',
            badge: ']',
            click: () => {
              this.moveTransformerNodes('down', false)
              this.isContextMenuOpen = false
            }
          },
          {
            label: 'Bring to Front',
            badge: '⇧ ]',
            click: () => {
              this.moveTransformerNodes('up', true)
              this.isContextMenuOpen = false
            }
          },
          {
            label: 'Send to Back',
            badge: '⇧ [',
            click: () => {
              this.moveTransformerNodes('down', true)
              this.isContextMenuOpen = false
            }
          }
        )

        downloadLinks.push({
          label: 'Download',
          badge: `${this.metaSymbol} ⇧ S`,
          click: () => {
            this.downloadTransformerNodes()
            this.isContextMenuOpen = false
          }
        })
      }

      const links = []
      if (manipulationLinks.length > 0) {
        links.push(manipulationLinks)
      }
      if (copyLinks.length > 0) {
        links.push(copyLinks)
      }
      if (movementLinks.length > 0) {
        links.push(movementLinks)
      }
      if (downloadLinks.length > 0) {
        links.push(downloadLinks)
      }

      return links
    }
  },
  watch: {
    tool: {
      immediated: true,
      handler(tool) {
        if (this.stage) {
          const isDraggable = tool === 'H'
          this.stage.draggable(isDraggable)

          // Update draggability of all .outputs on the stage
          this.stage.find('.output').forEach((group) => {
            group.draggable(!isDraggable)
          })

          // Enable/disable transformer based on the tool
          this.transformer.resizeEnabled(!isDraggable)
          this.transformer.rotateEnabled(!isDraggable)
        }
      }
    },
    outputs: {
      deep: true,
      handler() {
        this.updateCanvas()
      }
    }
  },
  methods: {
    ...mapActions(usePredictionStore, [
      'updateOutputPosition',
      'addOutput',
      'removeOutput'
    ]),
    handleMouseDown(e) {
      this.isDragging = true

      if (this.tool === 'V') {
        // Check if the target is a transformer handle
        if (
          e.target.getParent() &&
          e.target.getParent().className === 'Transformer'
        ) {
          return // Exit early if it's a transformer handle
        }

        const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey

        if (e.target instanceof Konva.Stage) {
          if (!metaPressed) {
            this.setTransformerNodes([])
          }
          this.selection.startPos = this.getRelativePointerPosition()

          this.selection.rect = new Konva.Rect({
            fill: 'rgba(235, 179, 5, 0.1)',
            stroke: '#ebb305',
            strokeWidth: 1 / this.stage.scaleX(), // Adjust line width based on zoom
            visible: false
          })
          this.selection.layer.add(this.selection.rect)
        } else {
          // Find the top-level Group
          let topGroup = e.target
          while (topGroup.getAttr('name') !== 'output') {
            topGroup = topGroup.getParent()
          }

          this.hideBorder(topGroup) // Remove stroke when deselected

          const isSelected = this.transformer.nodes().indexOf(topGroup) >= 0
          if (!isSelected) {
            if (metaPressed) {
              const nodes = this.transformer.nodes().concat([topGroup])
              this.setTransformerNodes(nodes)
            } else {
              this.setTransformerNodes([topGroup])
            }
          } else if (metaPressed) {
            const nodes = this.transformer
              .nodes()
              .filter((node) => node !== topGroup)
            this.setTransformerNodes(nodes)
          }
        }
      }
    },
    handleMouseMove(e) {
      if (this.tool === 'V' && this.selection.startPos && this.isDragging) {
        const pos = this.getRelativePointerPosition()
        this.selection.rect.setAttrs({
          visible: true,
          x: Math.min(pos.x, this.selection.startPos.x),
          y: Math.min(pos.y, this.selection.startPos.y),
          width: Math.abs(pos.x - this.selection.startPos.x),
          height: Math.abs(pos.y - this.selection.startPos.y)
        })

        // Update transformer with intersecting .outputs
        const groups = this.stage.find('.output').filter((group) => {
          // Exclude selection rectangle, transformer, and its handlers
          return (
            !(group instanceof Konva.Transformer) &&
            group.getParent().className !== 'Transformer'
          )
        })
        const box = this.selection.rect.getClientRect()
        const selected = groups.filter((group) =>
          Konva.Util.haveIntersection(box, group.getClientRect())
        )

        const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey
        if (metaPressed) {
          const currentNodes = this.transformer.nodes()
          const newNodes = selected.filter(
            (group) => !currentNodes.includes(group)
          )
          this.setTransformerNodes(currentNodes.concat(newNodes))
        } else {
          this.setTransformerNodes(selected)
        }

        this.selection.layer.batchDraw()
        this.layer.batchDraw()
      }
    },
    handleMouseUp(e) {
      this.isDragging = false

      if (this.tool === 'V') {
        if (this.selection.rect) {
          this.selection.rect.destroy()
        }

        this.selection.rect = null
        this.selection.startPos = null
        this.selection.layer.batchDraw()
        this.layer.batchDraw()
      }
    },
    handleWheel(e) {
      this.zoom(e)
      this.saveCanvasState()
    },
    zoom(e) {
      e.evt.preventDefault()

      const stage = e.target.getStage()
      const position = { x: stage.x(), y: stage.y() }

      // Zooming
      if (e.evt.ctrlKey) {
        const scaleBy = 1.02
        const minZoom = 0.2
        const maxZoom = 20
        const oldScale = stage.scaleX()

        const mousePointTo = {
          x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
          y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale
        }

        let newScale =
          e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy

        // Clamp the scale between minZoom and maxZoom
        newScale = Math.max(minZoom, Math.min(newScale, maxZoom))

        stage.scale({ x: newScale, y: newScale })

        // Update stroke width only for .outputs with non-zero strokeWidth
        this.stage.find('.output').forEach((group) => {
          const border = group.findOne('.border')
          if (border) {
            this.updateBorder(group)
          }
        })

        position.x =
          -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale
        position.y =
          -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale

        // Panning
      } else {
        const deltaX = e.evt.deltaX
        const deltaY = e.evt.deltaY

        position.x = stage.x() - deltaX
        position.y = stage.y() - deltaY
      }

      stage.position(position)
      stage.batchDraw()
    },
    getRelativePointerPosition() {
      const transform = this.stage.getAbsoluteTransform().copy()
      transform.invert()
      const pos = this.stage.getPointerPosition()
      return transform.point(pos)
    },
    loadCanvasState() {
      this.stage.position(this.canvasState.stagePosition)
      this.stage.scale(this.canvasState.stageScale)
      this.layer.batchDraw()
    },
    saveCanvasState() {
      this.canvasState = {
        stagePosition: this.stage.position(),
        stageScale: this.stage.scale()
      }
    },
    hasOutputGroupChanged(group, output) {
      return (
        group.width() !== output.metadata.width ||
        group.height() !== output.metadata.height ||
        group.getAttr('status') !== output.status
      )
    },
    updateCanvas() {
      // Remove .outputs that are not in the outputs array
      this.layer.find('.output').forEach((group) => {
        if (!this.outputs.some((output) => output.id === group.id())) {
          group.destroy()
        }
      })

      // Update or add .outputs for each output
      this.outputs.forEach((output) => {
        let group = this.stage.findOne(`#${output.id}`)
        if (!group) {
          group = this.createOutput(output)
          this.layer.add(group)
          this.updateOutputGroup(group, output)
        } else {
          // Only update if the shape's properties have changed
          if (this.hasOutputGroupChanged(group, output)) {
            this.updateOutputGroup(group, output)
          }
        }
      })

      // Always move transformer to to after a new shape has been added
      this.transformer.moveToTop()

      this.layer.batchDraw()
    },
    createOutput(output) {
      const group = new Konva.Group({
        name: 'output',
        id: output.id,
        x: output.metadata.x,
        y: output.metadata.y,
        rotation: output.metadata.rotation,
        width: output.metadata.width,
        height: output.metadata.height,
        draggable: this.tool !== 'H'
      })

      const content = new Konva.Rect({
        name: 'content',
        width: output.metadata.width,
        height: output.metadata.height,
        fill: '#f0f0f0'
      })

      const border = new Konva.Rect({
        name: 'border',
        width: output.metadata.width,
        height: output.metadata.height,
        stroke: '#ebb305',
        strokeWidth: BORDER_WIDTH,
        visible: false
      })

      group.add(content, border)

      group.on('mouseenter', () => {
        if (this.tool === 'V' && !this.transformer.nodes().includes(group)) {
          this.showBorder(group)
        }
      })

      group.on('mouseleave', () => {
        if (this.tool === 'V' && !this.transformer.nodes().includes(group)) {
          this.hideBorder(group)
        }
      })

      group.on('dragend', () => {
        this.updateOutputPosition({
          id: output.id,
          x: group.x(),
          y: group.y(),
          rotation: group.rotation(),
          width: group.width(),
          height: group.height()
        })
      })

      group.on('transformend', () => {
        this.updateOutputPosition({
          id: output.id,
          x: group.x(),
          y: group.y(),
          rotation: group.rotation(),
          width: group.width() * group.scaleX(),
          height: group.height() * group.scaleY()
        })

        // Reset scale after updating width and height
        group.scaleX(1)
        group.scaleY(1)
      })

      return group
    },
    showBorder(group) {
      const border = group.findOne('.border')
      border.moveToTop()
      border.visible(true)
      this.updateBorder(group)
      this.layer.batchDraw()
    },
    hideBorder(group) {
      const border = group.findOne('.border')
      border.visible(false)
      this.layer.batchDraw()
    },
    updateBorder(group) {
      const border = group.findOne('.border')
      const content = group.findOne('.content')
      border.setAttrs({
        width: content.width() * content.scaleX(),
        height: content.height() * content.scaleY(),
        strokeWidth: BORDER_WIDTH / this.stage.scaleX()
      })
    },
    updateOutputGroup(group, output) {
      group.setAttrs({
        x: output.metadata.x,
        y: output.metadata.y,
        rotation: output.metadata.rotation,
        width: output.metadata.width,
        height: output.metadata.height,
        status: output.status
      })

      const content = group.findOne('.content')
      content.setAttrs({
        width: output.metadata.width,
        height: output.metadata.height
      })

      this.updateBorder(group)

      // Remove existing placeholder text if it exists
      const existingText = group.findOne('.text')
      if (existingText) {
        existingText.destroy()
      }

      if (output.status === 'succeeded' && output.output && output.output[0]) {
        const img = new Image()
        img.onload = () => {
          const imageShape = new Konva.Image({
            image: img,
            width: output.metadata.width,
            height: output.metadata.height
          })
          content.destroy()
          group.add(imageShape)
          imageShape.setAttr('name', 'content')
          this.updateBorder(group)
          this.layer.batchDraw()
        }
        img.onerror = () => {
          this.createPlaceholder(group, 'Error loading image')
        }
        img.src = output.output[0]
      } else {
        this.createPlaceholder(group, output.status)
      }

      // Update the transformer if this group is selected
      if (this.transformer.nodes().includes(group)) {
        this.transformer.forceUpdate()
      }
    },
    createPlaceholder(group, status) {
      const content = group.findOne('.content')
      content.fill('#f0f0f0')

      // Remove existing placeholder text if it exists
      const existingText = group.findOne('.text')
      if (existingText) {
        existingText.destroy()
      }

      const text = new Konva.Text({
        name: 'text',
        text: status,
        fontSize: 14,
        fill: '#333',
        width: content.width(),
        align: 'center',
        verticalAlign: 'middle'
      })
      text.position({
        x: group.width() / 2 - text.width() / 2,
        y: group.height() / 2 - text.height() / 2
      })
      group.add(text)
      this.layer.batchDraw()
    },

    // Transformer utils
    setTransformerNodes(nodes = []) {
      this.transformer.nodes(nodes)
      this.selection.nodes = nodes
    },
    copyTransformerNodes(cut = false) {
      const selectedNodes = this.selection.nodes
      if (selectedNodes.length === 0) {
        return
      }

      const clipboardData = selectedNodes.map((node) => {
        const output = this.outputs.find((o) => o.id === node.id())
        return {
          ...output,
          metadata: {
            ...output.metadata,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            width: node.width(),
            height: node.height()
          }
        }
      })

      this.clipboard = clipboardData

      if (cut) {
        this.deleteTransformerNodes()
      }
    },
    copyTransformerNodesUrl() {
      const selectedNodes = this.selection.nodes
      if (selectedNodes.length !== 1) {
        return
      }
      const selectedNode = selectedNodes[0]
      const output = this.outputs.find((o) => o.id === selectedNode.id())
      if (output) {
        const prediction_id = output?.metadata?.prediction_id
        if (prediction_id) {
          navigator.clipboard.writeText(
            `https://replicate.com/p/${prediction_id}`
          )
        }
      }
    },
    pasteTransformerNodes() {
      if (!this.clipboard || this.clipboard.length === 0) {
        return
      }

      const mousePos = this.stage.getPointerPosition()
      const transform = this.stage.getAbsoluteTransform().copy()
      transform.invert()
      const relativeMousePos = transform.point(mousePos)

      // Calculate the bounding box of the clipboard items
      const boundingBox = this.clipboard.reduce((box, item) => {
        if (!box.minX) {
          return {
            minX: item.metadata.x,
            minY: item.metadata.y,
            maxX: item.metadata.x + item.metadata.width,
            maxY: item.metadata.y + item.metadata.height
          }
        }
        return {
          minX: Math.min(box.minX, item.metadata.x),
          minY: Math.min(box.minY, item.metadata.y),
          maxX: Math.max(box.maxX, item.metadata.x + item.metadata.width),
          maxY: Math.max(box.maxY, item.metadata.y + item.metadata.height)
        }
      }, {})

      const offsetX =
        relativeMousePos.x - (boundingBox.minX + boundingBox.maxX) / 2
      const offsetY =
        relativeMousePos.y - (boundingBox.minY + boundingBox.maxY) / 2

      const newOutputs = this.clipboard.map((item) => {
        const newId = `output-${item.id}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`
        return {
          ...item,
          id: newId,
          metadata: {
            ...item.metadata,
            x: item.metadata.x + offsetX,
            y: item.metadata.y + offsetY
          }
        }
      })

      // Add new outputs to the canvas
      this.addOutput(newOutputs)

      // Clear selection and select new outputs
      this.setTransformerNodes([])
      this.$nextTick(() => {
        const newNodes = newOutputs.map((output) =>
          this.stage.findOne(`#${output.id}`)
        )
        this.setTransformerNodes(newNodes)
      })
    },
    moveTransformerNodes(direction = 'up', full = false) {
      const selectedNodes = this.transformer.nodes()
      if (selectedNodes.length === 0) {
        return
      }

      selectedNodes.forEach((node) => {
        if (direction === 'up') {
          if (full) {
            node.moveToTop()
          } else {
            node.moveUp()
          }
        } else {
          if (full) {
            node.moveToBottom()
          } else {
            node.moveDown()
          }
        }
      })

      // Move the transformer to the top to keep it above the moved nodes
      this.transformer.moveToTop()

      // Redraw the layer
      this.layer.batchDraw()
    },
    deleteTransformerNodes() {
      const selectedNodes = this.transformer.nodes()
      selectedNodes.forEach((node) => {
        this.removeOutput(node.id())
      })
      this.setTransformerNodes([])
      this.layer.batchDraw()
    },
    downloadTransformerNodes() {
      const selectedNodes = this.transformer.nodes()
      if (selectedNodes.length === 0) {
        return
      }

      selectedNodes.forEach((node) => {
        const output = this.outputs.find((o) => o.id === node.id())
        if (output && output.output && output.output[0]) {
          const dataUri = output.output[0]

          // Extract file type from data URI
          const fileType = dataUri.split(';')[0].split('/')[1]
          const fileName = `${output.id}.${fileType}`

          // Convert data URI to Blob
          const byteString = atob(dataUri.split(',')[1])
          const mimeString = dataUri.split(',')[0].split(':')[1].split(';')[0]
          const ab = new ArrayBuffer(byteString.length)
          const ia = new Uint8Array(ab)
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i)
          }
          const blob = new Blob([ab], { type: mimeString })

          // Create download link and trigger download
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.style.display = 'none'
          a.href = url
          a.download = fileName
          document.body.appendChild(a)
          a.click()
          URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      })
    },

    // Snapping
    getSnapLines(skipShapes) {
      const vertical = []
      const horizontal = []

      const skipIds = skipShapes.map((shape) => shape.id())

      // and we snap over edges and center of each object on the canvas
      this.stage.find('.output').forEach((guideItem) => {
        if (skipIds.includes(guideItem.id())) {
          return
        }
        const box = guideItem.getClientRect()

        vertical.push([box.x, box.x + box.width, box.x + box.width / 2])
        horizontal.push([box.y, box.y + box.height, box.y + box.height / 2])
      })

      return {
        vertical: vertical.flat(),
        horizontal: horizontal.flat()
      }
    },
    getShapeSnappingEdges() {
      const box = this.transformer.findOne('.back').getClientRect()
      const absPos = this.transformer.findOne('.back').absolutePosition()

      return {
        vertical: [
          // Left vertical edge
          {
            guide: box.x,
            offset: absPos.x - box.x,
            snap: 'start'
          },
          // Center vertical edge
          {
            guide: box.x + box.width / 2,
            offset: absPos.x - box.x - box.width / 2,
            snap: 'center'
          },
          // Right vertical edge
          {
            guide: box.x + box.width,
            offset: absPos.x - box.x - box.width,
            snap: 'end'
          }
        ],
        horizontal: [
          // Top horizontal edge
          {
            guide: box.y,
            offset: absPos.y - box.y,
            snap: 'start'
          },
          // Center horizontal edge
          {
            guide: box.y + box.height / 2,
            offset: absPos.y - box.y - box.height / 2,
            snap: 'center'
          },
          // Bottom horizontal edge
          {
            guide: box.y + box.height,
            offset: absPos.y - box.y - box.height,
            snap: 'end'
          }
        ]
      }
    },
    getClosestSnapLines(possibleSnapLines, shapeSnappingEdges) {
      const SNAP_THRESHOLD = 3

      const getAllSnapLines = (direction) => {
        const result = []
        possibleSnapLines[direction].forEach((snapLine) => {
          shapeSnappingEdges[direction].forEach((snappingEdge) => {
            const diff = Math.abs(snapLine - snappingEdge.guide)
            // If the distance between the line and the shape is less than the threshold, we will consider it a snapping point.
            if (diff > SNAP_THRESHOLD) {
              return
            }

            const { snap, offset } = snappingEdge
            result.push({ snapLine, diff, snap, offset })
          })
        })
        return result
      }

      const resultV = getAllSnapLines('vertical')
      const resultH = getAllSnapLines('horizontal')

      const closestSnapLines = []

      const getSnapLine = ({ snapLine, offset, snap }, orientation) => {
        return { snapLine, offset, orientation, snap }
      }

      // Get up to 3 closest vertical and horizontal snapping lines
      const sortedV = resultV.sort((a, b) => a.diff - b.diff).slice(0, 10)
      const sortedH = resultH.sort((a, b) => a.diff - b.diff).slice(0, 10)

      sortedV.forEach((v) => closestSnapLines.push(getSnapLine(v, 'V')))
      sortedH.forEach((h) => closestSnapLines.push(getSnapLine(h, 'H')))

      return closestSnapLines
    },
    drawLines(lines = []) {
      const stageScale = this.stage.scaleX()

      lines.forEach((l) => {
        const { start, end } = this.calculateLineEndpoints(l)

        if (l.orientation === 'H') {
          const line = new Konva.Line({
            points: [start.x, start.y, end.x, end.y],
            stroke: '#ebb305',
            strokeWidth: 1 / stageScale,
            name: 'guid-line'
          })
          this.layer.add(line)
        } else if (l.orientation === 'V') {
          const line = new Konva.Line({
            points: [start.x, start.y, end.x, end.y],
            stroke: '#ebb305',
            strokeWidth: 1 / stageScale,
            name: 'guid-line'
          })
          this.layer.add(line)
        }
      })

      this.layer.batchDraw()
    },
    calculateLineEndpoints(line) {
      const selectedNodes = this.transformer.nodes()
      const selectedBox = this.transformer.findOne('.back').getClientRect()
      let start, end

      // Get stage transform
      const stageTransform = this.stage.getAbsoluteTransform().copy()
      stageTransform.invert()

      const transformPoint = (point) => {
        return stageTransform.point(point)
      }

      if (line.orientation === 'V') {
        start = transformPoint({ x: line.snapLine, y: selectedBox.y })
        end = transformPoint({
          x: line.snapLine,
          y: selectedBox.y + selectedBox.height
        })

        this.stage.find('.output').forEach((shape) => {
          if (!selectedNodes.includes(shape)) {
            const box = shape.getClientRect()
            if (
              Math.abs(box.x - line.snapLine) < 1 ||
              Math.abs(box.x + box.width - line.snapLine) < 1 ||
              Math.abs(box.x + box.width / 2 - line.snapLine) < 1
            ) {
              start.y = Math.min(start.y, transformPoint({ x: 0, y: box.y }).y)
              end.y = Math.max(
                end.y,
                transformPoint({ x: 0, y: box.y + box.height }).y
              )
            }
          }
        })
      } else {
        start = transformPoint({ x: selectedBox.x, y: line.snapLine })
        end = transformPoint({
          x: selectedBox.x + selectedBox.width,
          y: line.snapLine
        })

        this.stage.find('.output').forEach((shape) => {
          if (!selectedNodes.includes(shape)) {
            const box = shape.getClientRect()
            if (
              Math.abs(box.y - line.snapLine) < 1 ||
              Math.abs(box.y + box.height - line.snapLine) < 1 ||
              Math.abs(box.y + box.height / 2 - line.snapLine) < 1
            ) {
              start.x = Math.min(start.x, transformPoint({ x: box.x, y: 0 }).x)
              end.x = Math.max(
                end.x,
                transformPoint({ x: box.x + box.width, y: 0 }).x
              )
            }
          }
        })
      }

      return { start, end }
    },
    handleDragMove(e) {
      // clear all previous lines on the screen
      this.layer.find('.guid-line').forEach((l) => l.destroy())

      const selectedNodes = e.target.getNodes()

      if (!selectedNodes || selectedNodes.length <= 0) {
        return
      }

      const possibleSnappingLines = this.getSnapLines(selectedNodes)
      const selectedShapeSnappingEdges = this.getShapeSnappingEdges()
      const closestSnapLines = this.getClosestSnapLines(
        possibleSnappingLines,
        selectedShapeSnappingEdges
      )
      // Do nothing if no snapping lines
      if (closestSnapLines.length === 0) {
        return
      }

      this.drawLines(closestSnapLines)

      const orgAbsPos = this.transformer.absolutePosition()
      const absPos = this.transformer.absolutePosition()

      // Find new position
      closestSnapLines.forEach((l) => {
        let position = l.snapLine + l.offset
        if (l.snap === 'start') {
          position -= BORDER_WIDTH / 2 // Account for border
        } else if (l.snap === 'end') {
          position += BORDER_WIDTH / 2 // Account for border
        }
        position = Math.round(position * 100) / 100

        if (l.orientation === 'V') {
          absPos.x = position
        } else if (l.orientation === 'H') {
          absPos.y = position
        }
      })

      // calculate the difference between original and new position
      const vecDiff = {
        x: orgAbsPos.x - absPos.x,
        y: orgAbsPos.y - absPos.y
      }

      // apply the difference to the selected shape.
      selectedNodes.forEach((node) => {
        const nodeAbsPos = node.getAbsolutePosition()
        const newPos = {
          x: nodeAbsPos.x - vecDiff.x,
          y: nodeAbsPos.y - vecDiff.y
        }

        node.setAbsolutePosition(newPos)
      })
    },
    handleDragEnd() {
      this.layer.find('.guid-line').forEach((l) => l.destroy())
    }
  },
  mounted() {
    // Create objects
    this.stage = new Konva.Stage({
      container: this.$refs.canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      draggable: this.tool === 'H'
    })
    this.layer = new Konva.Layer()
    this.selection.layer = new Konva.Layer()
    this.transformer = new Konva.Transformer({
      borderStroke: '#ebb305',
      anchorStroke: '#ebb305',
      anchorFill: '#ffffff',
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      shouldOverdrawWholeArea: true,
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315]
    })

    // Init
    this.stage.getContainer().style.backgroundColor = '#f8f8f8'
    this.layer.add(this.transformer)
    this.stage.add(this.layer)
    this.stage.add(this.selection.layer)

    this.loadCanvasState()
    this.updateCanvas()

    // Add event listener for stage changes
    this.stage.on('wheel', this.handleWheel)
    this.stage.on('mousedown', this.handleMouseDown)
    this.stage.on('mousemove', this.handleMouseMove)
    this.stage.on('mouseup', this.handleMouseUp)
    this.stage.on('dragend', this.saveCanvasState)

    // Add event listeners for transformer
    this.transformer.on('dragmove', this.handleDragMove)
    this.transformer.on('dragend', this.handleDragEnd)

    // Update the transformer refs with the actual methods
    this.moveTransformerNodesRef = this.moveTransformerNodes.bind(this)
    this.copyTransformerNodesRef = this.copyTransformerNodes.bind(this)
    this.copyTransformerNodesUrlRef = this.copyTransformerNodesUrl.bind(this)
    this.pasteTransformerNodesRef = this.pasteTransformerNodes.bind(this)
    this.deleteTransformerNodesRef = this.deleteTransformerNodes.bind(this)
    this.downloadTransformerNodesRef = this.downloadTransformerNodes.bind(this)
  }
}
</script>

<style lang="stylus" scoped></style>
