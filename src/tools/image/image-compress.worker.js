// Large-image compression runs here so decoding/resizing/encoding a 50 MP photo
// does not block the page. Falls back to the main thread when OffscreenCanvas
// or createImageBitmap is unavailable in the worker.
self.onmessage = async event => {
  const { id, file, maxWidth, maxHeight, format, quality } = event.data || {}
  try {
    const bitmap = await createImageBitmap(file)
    const sourceWidth = bitmap.width
    const sourceHeight = bitmap.height
    const scale = Math.min(1, (maxWidth || sourceWidth) / sourceWidth, (maxHeight || sourceHeight) / sourceHeight)
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await canvas.convertToBlob({ type: format, quality })
    const buffer = await blob.arrayBuffer()
    bitmap.close?.()
    self.postMessage({
      id,
      type: 'done',
      buffer,
      blobType: blob.type,
      size: blob.size,
      sourceWidth,
      sourceHeight,
      outputWidth: width,
      outputHeight: height
    }, [buffer])
  } catch (error) {
    self.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
