import qrcode from "qrcode-generator"

export function generateQRDataURL(text: string, size: number = 256): string {
  const qr = qrcode(0, "L")
  qr.addData(text)
  qr.make()

  const modules = qr.getModuleCount()
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!

  const cellSize = size / (modules + 4)
  const offset = (size - cellSize * modules) / 2

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, size, size)

  ctx.fillStyle = "#000000"
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(
          Math.round(offset + col * cellSize),
          Math.round(offset + row * cellSize),
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        )
      }
    }
  }

  return canvas.toDataURL("image/png")
}
