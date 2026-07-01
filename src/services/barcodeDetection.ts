import type { IScannerControls } from '@zxing/browser'
import type { BarcodeFormat } from '../types/loyaltyCards'

export type DetectedBarcode = {
  value: string
  format: BarcodeFormat
}

export type PreparedBarcodeImage = {
  file: File
  previewUrl: string
  width: number
  height: number
}

type NativeBarcodeDetectorResult = {
  rawValue?: string
  format?: string
}

type NativeBarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): {
    detect(image: CanvasImageSource): Promise<NativeBarcodeDetectorResult[]>
  }
  getSupportedFormats?: () => Promise<string[]>
}

type WindowWithBarcodeDetector = Window &
  typeof globalThis & {
    BarcodeDetector?: NativeBarcodeDetectorConstructor
  }

const maxScanSide = 1800
const previewQuality = 0.86
const nativeFormatCandidates = [
  'code_128',
  'ean_13',
  'ean_8',
  'qr_code',
  'upc_a',
  'upc_e',
  'data_matrix',
  'itf',
  'codabar',
]

const formatAliases = new Map<string, BarcodeFormat>([
  ['code128', 'code128'],
  ['code_128', 'code128'],
  ['code-128', 'code128'],
  ['ean13', 'ean13'],
  ['ean_13', 'ean13'],
  ['ean-13', 'ean13'],
  ['ean8', 'ean8'],
  ['ean_8', 'ean8'],
  ['ean-8', 'ean8'],
  ['qr', 'qr'],
  ['qr_code', 'qr'],
  ['qrcode', 'qr'],
  ['qr-code', 'qr'],
  ['upca', 'upca'],
  ['upc_a', 'upca'],
  ['upc-a', 'upca'],
  ['upce', 'upce'],
  ['upc_e', 'upce'],
  ['upc-e', 'upce'],
  ['datamatrix', 'datamatrix'],
  ['data_matrix', 'datamatrix'],
  ['data-matrix', 'datamatrix'],
  ['itf', 'itf'],
  ['interleaved_2_of_5', 'itf'],
  ['codabar', 'codabar'],
])

const zxingNumberFormatNames = [
  'AZTEC',
  'CODABAR',
  'CODE_39',
  'CODE_93',
  'CODE_128',
  'DATA_MATRIX',
  'EAN_8',
  'EAN_13',
  'ITF',
  'MAXICODE',
  'PDF_417',
  'QR_CODE',
  'RSS_14',
  'RSS_EXPANDED',
  'UPC_A',
  'UPC_E',
  'UPC_EAN_EXTENSION',
  'MICRO_QR_CODE',
]

export const normalizeBarcodeFormat = (format: unknown): BarcodeFormat => {
  if (typeof format === 'number') {
    return normalizeBarcodeFormat(zxingNumberFormatNames[format])
  }

  if (typeof format !== 'string') return 'other'

  const key = format.trim().toLowerCase().replace(/\s+/g, '_')
  return formatAliases.get(key) ?? 'other'
}

const getNativeDetector = () =>
  typeof window === 'undefined'
    ? null
    : (window as WindowWithBarcodeDetector).BarcodeDetector ?? null

export const isNativeBarcodeDetectorAvailable = () => Boolean(getNativeDetector())

export async function getNativeSupportedBarcodeFormats() {
  const BarcodeDetector = getNativeDetector()
  if (!BarcodeDetector) return []

  if (!BarcodeDetector.getSupportedFormats) return nativeFormatCandidates

  try {
    return await BarcodeDetector.getSupportedFormats()
  } catch {
    return []
  }
}

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const imageBitmapFromFile = async (file: File) => {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  } catch {
    return createImageBitmap(file)
  }
}

const drawImageToCanvas = (image: ImageBitmap, maxSide = maxScanSide) => {
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * ratio))
  const height = Math.max(1, Math.round(image.height * ratio))
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Nem sikerült feldolgozni a képet.')
  context.drawImage(image, 0, 0, width, height)
  return canvas
}

const canvasToFile = async (canvas: HTMLCanvasElement, source: File) => {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', previewQuality),
  )

  if (!blob) throw new Error('Nem sikerült előkészíteni a képet.')

  const baseName = source.name.replace(/\.[^.]+$/, '') || 'loyalty-card'
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

const createHighContrastCanvas = (source: HTMLCanvasElement) => {
  const canvas = createCanvas(source.width, source.height)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  context.drawImage(source, 0, 0)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
    const contrast = gray > 135 ? 255 : 0
    data[index] = contrast
    data[index + 1] = contrast
    data[index + 2] = contrast
  }
  context.putImageData(imageData, 0, 0)
  return canvas
}

export async function prepareBarcodeImage(file: File): Promise<PreparedBarcodeImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Nem támogatott fájltípus.')
  }

  const bitmap = await imageBitmapFromFile(file)
  try {
    const canvas = drawImageToCanvas(bitmap)
    const preparedFile = await canvasToFile(canvas, file)
    return {
      file: preparedFile,
      previewUrl: URL.createObjectURL(preparedFile),
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    bitmap.close()
  }
}

async function detectWithNative(canvas: HTMLCanvasElement): Promise<DetectedBarcode | null> {
  const BarcodeDetector = getNativeDetector()
  if (!BarcodeDetector) return null

  const supportedFormats = await getNativeSupportedBarcodeFormats()
  const requestedFormats = nativeFormatCandidates.filter((format) =>
    supportedFormats.includes(format),
  )

  const detector = new BarcodeDetector(
    requestedFormats.length > 0 ? { formats: requestedFormats } : undefined,
  )
  const results = await detector.detect(canvas)
  const result = results.find((item) => item.rawValue)

  return result?.rawValue
    ? { value: result.rawValue, format: normalizeBarcodeFormat(result.format) }
    : null
}

async function detectWithZxing(canvas: HTMLCanvasElement): Promise<DetectedBarcode | null> {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const reader = new BrowserMultiFormatReader()
  const result = reader.decodeFromCanvas(canvas)
  const value = result.getText()

  return value
    ? { value, format: normalizeBarcodeFormat(result.getBarcodeFormat()) }
    : null
}

export async function detectBarcodeFromFile(
  file: File,
  signal?: AbortSignal,
): Promise<DetectedBarcode | null> {
  if (signal?.aborted) return null

  const bitmap = await imageBitmapFromFile(file)
  try {
    const canvas = drawImageToCanvas(bitmap)
    const highContrastCanvas = createHighContrastCanvas(canvas)
    const canvases = highContrastCanvas ? [canvas, highContrastCanvas] : [canvas]

    for (const candidate of canvases) {
      if (signal?.aborted) return null

      try {
        const nativeResult = await detectWithNative(candidate)
        if (nativeResult) return nativeResult
      } catch {
        // Fall through to ZXing for browsers with partial native support.
      }

      if (signal?.aborted) return null

      try {
        const fallbackResult = await detectWithZxing(candidate)
        if (fallbackResult) return fallbackResult
      } catch {
        // Try the next preprocessed variant.
      }
    }

    return null
  } finally {
    bitmap.close()
  }
}

export async function startLiveBarcodeScanner({
  videoElement,
  onDetected,
  onError,
}: {
  videoElement: HTMLVideoElement
  onDetected: (barcode: DetectedBarcode) => void
  onError: (error: Error) => void
}) {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const reader = new BrowserMultiFormatReader()

  try {
    const controls = await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      videoElement,
      (result, error, scannerControls) => {
        if (result?.getText()) {
          onDetected({
            value: result.getText(),
            format: normalizeBarcodeFormat(result.getBarcodeFormat()),
          })
          scannerControls.stop()
        } else if (error && error.name !== 'NotFoundException') {
          onError(error instanceof Error ? error : new Error('A kamera beolvasás sikertelen.'))
        }
      },
    )

    return controls as IScannerControls
  } catch (error) {
    throw error instanceof Error ? error : new Error('Nem sikerült megnyitni a kamerát.')
  }
}

const hasValidEanChecksum = (value: string) => {
  if (!/^\d+$/.test(value) || (value.length !== 8 && value.length !== 13)) return false

  const digits = value.split('').map(Number)
  const checkDigit = digits.pop()
  if (checkDigit === undefined) return false

  const sum = digits.reduce((total, digit, index) => {
    const weight =
      value.length === 13
        ? index % 2 === 0
          ? 1
          : 3
        : index % 2 === 0
          ? 3
          : 1
    return total + digit * weight
  }, 0)

  return (10 - (sum % 10)) % 10 === checkDigit
}

export const inferManualBarcodeFormat = (value: string): BarcodeFormat => {
  const normalizedValue = value.replace(/\s+/g, '')
  if (normalizedValue.length === 8 && hasValidEanChecksum(normalizedValue)) return 'ean8'
  if (normalizedValue.length === 13 && hasValidEanChecksum(normalizedValue)) return 'ean13'
  return 'other'
}
