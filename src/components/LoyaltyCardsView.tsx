import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import type { IScannerControls } from '@zxing/browser'
import {
  createLoyaltyCard,
  createSignedImageUrls,
  deleteLoyaltyCard,
  deleteStoredImages,
  loadLoyaltyCards,
  toggleFavorite,
  updateLoyaltyCard,
  uploadCardImage,
} from '../lib/loyaltyCards'
import {
  detectBarcodeFromFile,
  inferManualBarcodeFormat,
  prepareBarcodeImage,
  startLiveBarcodeScanner,
} from '../services/barcodeDetection'
import type { BarcodeFormat, LoyaltyCard } from '../types/loyaltyCards'
import { BrandHeader } from './BrandHeader'
import { MobileBottomNav } from './MobileBottomNav'

type LoyaltyCardsViewProps = {
  userId: string
  onOpenHome: () => void
  onOpenReports: () => void
  onOpenLists: () => void
  onOpenProfile: () => void
  onAddTransaction: () => void
}

type Message = { type: 'success' | 'error'; text: string }
type ImageUrls = Record<string, { front: string | null; back: string | null }>
type FormStep = 'front' | 'barcode' | 'confirm'
type RecognitionState = 'idle' | 'scanning' | 'success' | 'failed' | 'manual'

type CardFormState = {
  name: string
  provider: string
  cardNumber: string
  barcodeValue: string
  barcodeFormat: BarcodeFormat
  color: string
  icon: string
  notes: string
  isFavorite: boolean
}

const emptyForm: CardFormState = {
  name: '',
  provider: '',
  cardNumber: '',
  barcodeValue: '',
  barcodeFormat: 'other',
  color: '#0f766e',
  icon: '★',
  notes: '',
  isFavorite: false,
}

const maskCardNumber = (cardNumber: string | null) => {
  const digits = cardNumber?.replace(/\D/g, '') ?? ''
  if (digits.length <= 4) return cardNumber || ''
  return `•••• ${digits.slice(-4)}`
}

const isBlobUrl = (url: string | null): url is string => Boolean(url?.startsWith('blob:'))

const revokePreview = (url: string | null) => {
  if (isBlobUrl(url)) URL.revokeObjectURL(url)
}

const suggestProviderFromFilename = (filename: string) => {
  const cleaned = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(img|image|photo|foto|kép|scan|card|kartya|kártya)\b/gi, '')
    .replace(/\b\d{4,}\b/g, '')
    .trim()

  return /^[\p{L}\d .&'+-]{3,40}$/u.test(cleaned) ? cleaned : ''
}

const getInitialForm = (card?: LoyaltyCard | null): CardFormState =>
  card
    ? {
        name: card.name,
        provider: card.provider ?? '',
        cardNumber: card.card_number ?? '',
        barcodeValue: card.barcode_value ?? '',
        barcodeFormat: card.barcode_format ?? 'other',
        color: card.color ?? '#0f766e',
        icon: card.icon ?? '★',
        notes: card.notes ?? '',
        isFavorite: card.is_favorite,
      }
    : emptyForm

function LoyaltyCardsIllustration() {
  return (
    <svg
      className="loyalty-empty-illustration"
      viewBox="0 0 96 72"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="18" y="16" width="58" height="38" rx="8" />
      <rect x="26" y="26" width="18" height="8" rx="3" />
      <path d="M29 44h2M36 44h2M43 44h2M50 44h2M57 44h2M64 44h2" />
      <path d="M70 14l2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z" />
      <path d="M14 24v-3a9 9 0 0 1 9-9h42" />
    </svg>
  )
}

export function LoyaltyCardsView({
  userId,
  onOpenHome,
  onOpenReports,
  onOpenLists,
  onOpenProfile,
  onAddTransaction,
}: LoyaltyCardsViewProps) {
  const saveLockRef = useRef(false)
  const scanAbortRef = useRef<AbortController | null>(null)
  const liveControlsRef = useRef<IScannerControls | null>(null)
  const frontPreviewRef = useRef<string | null>(null)
  const backPreviewRef = useRef<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const frontCameraInputRef = useRef<HTMLInputElement | null>(null)
  const frontGalleryInputRef = useRef<HTMLInputElement | null>(null)
  const backCameraInputRef = useRef<HTMLInputElement | null>(null)
  const backGalleryInputRef = useRef<HTMLInputElement | null>(null)

  const [cards, setCards] = useState<LoyaltyCard[]>([])
  const [imageUrls, setImageUrls] = useState<ImageUrls>({})
  const [selectedCard, setSelectedCard] = useState<LoyaltyCard | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<LoyaltyCard | null>(null)
  const [formStep, setFormStep] = useState<FormStep>('front')
  const [form, setForm] = useState<CardFormState>(emptyForm)
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [showBackImage, setShowBackImage] = useState(false)
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle')
  const [recognitionMessage, setRecognitionMessage] = useState('')
  const [isLiveScanning, setIsLiveScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const favoriteCards = useMemo(
    () => cards.filter((card) => card.is_favorite),
    [cards],
  )
  const regularCards = useMemo(
    () => cards.filter((card) => !card.is_favorite),
    [cards],
  )

  const isBusy = isSaving || recognitionState === 'scanning' || isLiveScanning
  const currentCode = form.barcodeValue.trim() || form.cardNumber.trim()

  const refreshSignedUrls = async (nextCards: LoyaltyCard[]) => {
    const entries = await Promise.all(
      nextCards.map(async (card) => [card.id, await createSignedImageUrls(card)] as const),
    )
    setImageUrls(Object.fromEntries(entries))
  }

  const refreshCards = async () => {
    setIsLoading(true)
    const { data, error } = await loadLoyaltyCards(userId)
    if (error) {
      setMessage({ type: 'error', text: `Nem sikerült betölteni a kártyákat: ${error.message}` })
      setCards([])
    } else {
      setCards(data)
      await refreshSignedUrls(data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    void refreshCards()
  }, [userId])

  useEffect(() => {
    frontPreviewRef.current = frontPreview
  }, [frontPreview])

  useEffect(() => {
    backPreviewRef.current = backPreview
  }, [backPreview])

  useEffect(() => {
    return () => {
      revokePreview(frontPreviewRef.current)
      revokePreview(backPreviewRef.current)
      scanAbortRef.current?.abort()
      liveControlsRef.current?.stop()
    }
  }, [])

  const updateForm = (field: keyof CardFormState, value: string | boolean) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const stopLiveScan = () => {
    liveControlsRef.current?.stop()
    liveControlsRef.current = null
    setIsLiveScanning(false)
  }

  const applyDetectedBarcode = (value: string, format: BarcodeFormat) => {
    setForm((currentForm) => ({
      ...currentForm,
      barcodeValue: value,
      barcodeFormat: format,
      cardNumber: currentForm.cardNumber || value,
    }))
    setRecognitionState('success')
    setRecognitionMessage('Vonalkód felismerve')
    setFormStep('confirm')
  }

  const runBarcodeDetection = async (file: File, side: 'front' | 'back') => {
    scanAbortRef.current?.abort()
    const controller = new AbortController()
    scanAbortRef.current = controller
    setRecognitionState('scanning')
    setRecognitionMessage('Vonalkód keresése...')

    try {
      const detectedBarcode = await detectBarcodeFromFile(file, controller.signal)
      if (controller.signal.aborted) return

      if (detectedBarcode) {
        applyDetectedBarcode(detectedBarcode.value, detectedBarcode.format)
        return
      }

      if (side === 'front') {
        setRecognitionState('idle')
        setRecognitionMessage('')
        setFormStep('barcode')
      } else {
        setRecognitionState('failed')
        setRecognitionMessage('Nem találtunk jól olvasható vonalkódot.')
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setRecognitionState(side === 'front' ? 'idle' : 'failed')
      setRecognitionMessage(
        error instanceof Error ? error.message : 'Nem találtunk jól olvasható vonalkódot.',
      )
      if (side === 'front') setFormStep('barcode')
    }
  }

  const setImageFile = async (side: 'front' | 'back', file: File | null) => {
    if (!file) return
    setMessage(null)

    try {
      const preparedImage = await prepareBarcodeImage(file)
      if (side === 'front') {
        revokePreview(frontPreview)
        setFrontFile(preparedImage.file)
        setFrontPreview(preparedImage.previewUrl)
        setForm((currentForm) => ({
          ...currentForm,
          provider: currentForm.provider || suggestProviderFromFilename(file.name),
        }))
      } else {
        revokePreview(backPreview)
        setBackFile(preparedImage.file)
        setBackPreview(preparedImage.previewUrl)
      }

      await runBarcodeDetection(preparedImage.file, side)
    } catch (error) {
      setRecognitionState(side === 'back' ? 'failed' : 'idle')
      setRecognitionMessage(
        error instanceof Error ? error.message : 'Nem sikerült beolvasni a képet.',
      )
      if (side === 'front') setFormStep('barcode')
    }
  }

  const handleManualCode = (value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      barcodeValue: value,
      barcodeFormat: value.trim() ? inferManualBarcodeFormat(value) : 'other',
      cardNumber: value.trim() ? value : currentForm.cardNumber,
    }))
  }

  const openCreate = () => {
    scanAbortRef.current?.abort()
    stopLiveScan()
    setEditingCard(null)
    setForm(emptyForm)
    setFormStep('front')
    setFrontFile(null)
    setBackFile(null)
    revokePreview(frontPreview)
    revokePreview(backPreview)
    setFrontPreview(null)
    setBackPreview(null)
    setRecognitionState('idle')
    setRecognitionMessage('')
    setMessage(null)
    setIsFormOpen(true)
  }

  const openEdit = (card: LoyaltyCard) => {
    scanAbortRef.current?.abort()
    stopLiveScan()
    setEditingCard(card)
    setForm(getInitialForm(card))
    setFormStep('confirm')
    setFrontFile(null)
    setBackFile(null)
    revokePreview(frontPreview)
    revokePreview(backPreview)
    setFrontPreview(imageUrls[card.id]?.front ?? null)
    setBackPreview(imageUrls[card.id]?.back ?? null)
    setRecognitionState(card.barcode_value ? 'success' : 'idle')
    setRecognitionMessage(card.barcode_value ? 'Vonalkód felismerve' : '')
    setMessage(null)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    scanAbortRef.current?.abort()
    stopLiveScan()
    setIsFormOpen(false)
  }

  const upsertLocalCard = async (card: LoyaltyCard) => {
    const signedUrls = await createSignedImageUrls(card)
    setCards((currentCards) => {
      const nextCards = currentCards.some((currentCard) => currentCard.id === card.id)
        ? currentCards.map((currentCard) => (currentCard.id === card.id ? card : currentCard))
        : [card, ...currentCards]
      return [...nextCards].sort((first, second) =>
        first.is_favorite === second.is_favorite
          ? first.name.localeCompare(second.name, 'hu-HU')
          : first.is_favorite
            ? -1
            : 1,
      )
    })
    setImageUrls((currentUrls) => ({ ...currentUrls, [card.id]: signedUrls }))
    setSelectedCard((currentCard) => (currentCard?.id === card.id ? card : currentCard))
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saveLockRef.current || isSaving) return

    const name = form.name.trim()
    if (!name) {
      setMessage({ type: 'error', text: 'Add meg a kártya nevét.' })
      setFormStep('confirm')
      return
    }

    saveLockRef.current = true
    setIsSaving(true)
    setMessage(null)
    const uploadedPaths: string[] = []
    let createdCardId: string | null = null

    try {
      const barcodeValue = form.barcodeValue.trim()
      const visibleNumber = form.cardNumber.trim() || barcodeValue
      const basePayload = {
        name,
        provider: form.provider.trim() || null,
        card_number: visibleNumber || null,
        barcode_value: barcodeValue || null,
        barcode_format: barcodeValue ? form.barcodeFormat : null,
        color: form.color,
        icon: form.icon.trim() || null,
        notes: form.notes.trim() || null,
        is_favorite: form.isFavorite,
      }

      const cardResult = editingCard
        ? await updateLoyaltyCard(editingCard.id, basePayload)
        : await createLoyaltyCard({ user_id: userId, ...basePayload })

      if (cardResult.error || !cardResult.data) {
        throw cardResult.error ?? new Error('Nem sikerült menteni a kártyát.')
      }

      let nextCard = cardResult.data
      if (!editingCard) createdCardId = nextCard.id
      const imageUpdates: { front_image_path?: string; back_image_path?: string } = {}

      if (frontFile) {
        const { path, error } = await uploadCardImage({
          userId,
          cardId: nextCard.id,
          side: 'front',
          file: frontFile,
        })
        if (error || !path) throw error ?? new Error('Az előlap feltöltése sikertelen.')
        uploadedPaths.push(path)
        imageUpdates.front_image_path = path
      }

      if (backFile) {
        const { path, error } = await uploadCardImage({
          userId,
          cardId: nextCard.id,
          side: 'back',
          file: backFile,
        })
        if (error || !path) throw error ?? new Error('A hátlap feltöltése sikertelen.')
        uploadedPaths.push(path)
        imageUpdates.back_image_path = path
      }

      if (Object.keys(imageUpdates).length > 0) {
        const { data, error } = await updateLoyaltyCard(nextCard.id, imageUpdates)
        if (error || !data) throw error ?? new Error('A képek mentése sikertelen.')
        if (editingCard) {
          await deleteStoredImages([
            frontFile ? editingCard.front_image_path : null,
            backFile ? editingCard.back_image_path : null,
          ])
        }
        nextCard = data
      }

      await upsertLocalCard(nextCard)
      setMessage({ type: 'success', text: 'A kártya mentése sikerült.' })
      setIsFormOpen(false)
    } catch (error) {
      await deleteStoredImages(uploadedPaths)
      if (createdCardId && !editingCard) {
        await deleteLoyaltyCard(createdCardId)
      }
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Nem sikerült menteni a kártyát.',
      })
    } finally {
      saveLockRef.current = false
      setIsSaving(false)
    }
  }

  const handleToggleFavorite = async (card: LoyaltyCard) => {
    const optimisticCard = { ...card, is_favorite: !card.is_favorite }
    await upsertLocalCard(optimisticCard)
    const { data, error } = await toggleFavorite(card)
    if (error || !data) {
      await upsertLocalCard(card)
      setMessage({ type: 'error', text: 'Nem sikerült módosítani a kedvenc állapotot.' })
      return
    }
    await upsertLocalCard(data)
  }

  const handleDelete = async (card: LoyaltyCard) => {
    if (!window.confirm(`Biztosan törlöd ezt a kártyát: ${card.name}?`)) return

    const { error: storageError } = await deleteStoredImages([
      card.front_image_path,
      card.back_image_path,
    ])
    const { error } = await deleteLoyaltyCard(card.id)

    if (storageError || error) {
      setMessage({
        type: 'error',
        text: `A törlés nem sikerült teljesen: ${storageError?.message ?? error?.message}`,
      })
      return
    }

    setCards((currentCards) => currentCards.filter((currentCard) => currentCard.id !== card.id))
    setSelectedCard(null)
    setMessage({ type: 'success', text: 'A kártya törölve.' })
  }

  const startLiveScan = async () => {
    if (!videoRef.current) return
    setRecognitionState('scanning')
    setRecognitionMessage('Vonalkód keresése...')
    setIsLiveScanning(true)

    try {
      liveControlsRef.current = await startLiveBarcodeScanner({
        videoElement: videoRef.current,
        onDetected: (barcode) => {
          applyDetectedBarcode(barcode.value, barcode.format)
          stopLiveScan()
        },
        onError: (error) => {
          setRecognitionState('failed')
          setRecognitionMessage(error.message || 'Nem találtunk jól olvasható vonalkódot.')
        },
      })
    } catch (error) {
      setIsLiveScanning(false)
      setRecognitionState('failed')
      setRecognitionMessage(
        error instanceof Error ? error.message : 'Nem sikerült megnyitni a kamerát.',
      )
    }
  }

  const renderCardGrid = (items: LoyaltyCard[]) => (
    <div className="loyalty-card-grid">
      {items.map((card) => (
        <article
          className="loyalty-card-tile"
          key={card.id}
          style={{ '--loyalty-card-color': card.color ?? 'var(--accent)' } as CSSProperties}
        >
          <button type="button" onClick={() => setSelectedCard(card)}>
            <span className="loyalty-card-preview" aria-hidden="true">
              {imageUrls[card.id]?.front ? (
                <img src={imageUrls[card.id].front ?? ''} alt="" />
              ) : (
                <span>{card.icon || '★'}</span>
              )}
            </span>
            <span>
              <strong>{card.name}</strong>
              {card.provider ? <small>{card.provider}</small> : null}
              {card.card_number ? <em>{maskCardNumber(card.card_number)}</em> : null}
            </span>
          </button>
          <button
            className={card.is_favorite ? 'favorite active' : 'favorite'}
            type="button"
            aria-label={card.is_favorite ? 'Kedvenc eltávolítása' : 'Kedvencnek jelölés'}
            aria-pressed={card.is_favorite}
            onClick={() => void handleToggleFavorite(card)}
          >
            ★
          </button>
        </article>
      ))}
    </div>
  )

  const renderHiddenInputs = () => (
    <>
      <input
        ref={frontCameraInputRef}
        className="visually-hidden-file"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          void setImageFile('front', event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
        disabled={isBusy}
      />
      <input
        ref={frontGalleryInputRef}
        className="visually-hidden-file"
        type="file"
        accept="image/*"
        onChange={(event) => {
          void setImageFile('front', event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
        disabled={isBusy}
      />
      <input
        ref={backCameraInputRef}
        className="visually-hidden-file"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          void setImageFile('back', event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
        disabled={isBusy}
      />
      <input
        ref={backGalleryInputRef}
        className="visually-hidden-file"
        type="file"
        accept="image/*"
        onChange={(event) => {
          void setImageFile('back', event.target.files?.[0] ?? null)
          event.target.value = ''
        }}
        disabled={isBusy}
      />
    </>
  )

  const renderPreview = (src: string | null, alt: string) =>
    src ? (
      <div className="loyalty-step-preview">
        <img src={src} alt={alt} />
      </div>
    ) : null

  const renderRecognitionResult = () => {
    if (!['scanning', 'success', 'failed'].includes(recognitionState)) return null

    return (
      <div className={`recognition-result ${recognitionState}`} aria-live="polite">
        {recognitionState === 'scanning' ? <strong>Vonalkód keresése...</strong> : null}
        {recognitionState === 'success' ? (
          <>
            <strong>✓ Vonalkód felismerve</strong>
            <span>{form.barcodeValue}</span>
            <small>Formátum: {form.barcodeFormat}</small>
          </>
        ) : null}
        {recognitionState === 'failed' ? (
          <>
            <strong>Nem találtunk jól olvasható vonalkódot.</strong>
            {recognitionMessage &&
            recognitionMessage !== 'Nem találtunk jól olvasható vonalkódot.' ? (
              <small>{recognitionMessage}</small>
            ) : null}
          </>
        ) : null}
      </div>
    )
  }

  const renderFrontStep = () => (
    <section className="loyalty-step" aria-labelledby="cardFrontTitle">
      <h3 id="cardFrontTitle">Kártya előlapja</h3>
      <p className="loyalty-helper">Az előlap opcionális, de erősen ajánlott.</p>
      <div className="loyalty-action-grid">
        <button type="button" onClick={() => frontCameraInputRef.current?.click()} disabled={isBusy}>
          Fénykép készítése
        </button>
        <button type="button" onClick={() => frontGalleryInputRef.current?.click()} disabled={isBusy}>
          Kép kiválasztása
        </button>
      </div>
      {renderPreview(frontPreview, 'Kártya előlapjának előnézete')}
      {recognitionState === 'scanning' ? renderRecognitionResult() : null}
      <div className="loyalty-step-actions">
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={() => setFormStep('barcode')}
          disabled={isBusy}
        >
          Tovább
        </button>
      </div>
    </section>
  )

  const renderBarcodeStep = () => (
    <section className="loyalty-step" aria-labelledby="barcodeStepTitle">
      <h3 id="barcodeStepTitle">Vonalkód beolvasása</h3>
      <p className="loyalty-helper">
        Fotózd le azt az oldalt, amelyen a vonalkód vagy QR-kód található.
      </p>
      <div className="loyalty-action-grid">
        <button type="button" onClick={() => backCameraInputRef.current?.click()} disabled={isBusy}>
          Hátlap lefényképezése
        </button>
        <button type="button" onClick={() => backGalleryInputRef.current?.click()} disabled={isBusy}>
          Kép kiválasztása
        </button>
        <button type="button" onClick={() => void startLiveScan()} disabled={isBusy}>
          Kamera megnyitása
        </button>
      </div>
      {renderPreview(backPreview, 'Kártya hátlapjának előnézete')}
      <video
        ref={videoRef}
        className={isLiveScanning ? 'loyalty-live-video active' : 'loyalty-live-video'}
        muted
        playsInline
      />
      {renderRecognitionResult()}
      {recognitionState === 'failed' ? (
        <div className="loyalty-action-grid retry-actions">
          <button type="button" onClick={() => backCameraInputRef.current?.click()} disabled={isBusy}>
            Új fotó készítése
          </button>
          <button type="button" onClick={() => backGalleryInputRef.current?.click()} disabled={isBusy}>
            Másik kép választása
          </button>
          <button type="button" onClick={() => void startLiveScan()} disabled={isBusy}>
            Kód beolvasása kamerával
          </button>
          <button
            type="button"
            onClick={() => {
              setRecognitionState('manual')
              setRecognitionMessage('')
            }}
            disabled={isBusy}
          >
            Szám kézi megadása
          </button>
        </div>
      ) : null}
      {recognitionState === 'manual' ? (
        <label>
          Kód vagy kártyaszám
          <input
            value={form.barcodeValue}
            onChange={(event) => handleManualCode(event.target.value)}
            disabled={isSaving}
            inputMode="text"
          />
        </label>
      ) : null}
      <div className="loyalty-step-actions">
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={() => setFormStep('front')}
          disabled={isBusy}
        >
          Vissza
        </button>
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={() => setFormStep('confirm')}
          disabled={isBusy}
        >
          Tovább
        </button>
      </div>
    </section>
  )

  const renderConfirmStep = () => (
    <section className="loyalty-step" aria-labelledby="confirmationStepTitle">
      <h3 id="confirmationStepTitle">Megerősítés</h3>
      {currentCode ? renderRecognitionResult() : null}
      <label>
        Kártya neve
        <input
          value={form.name}
          onChange={(event) => updateForm('name', event.target.value)}
          required
          disabled={isSaving}
        />
      </label>
      <label>
        Szolgáltató / üzlet
        <input
          value={form.provider}
          onChange={(event) => updateForm('provider', event.target.value)}
          disabled={isSaving}
        />
      </label>
      <div className="loyalty-code-row">
        <label>
          Felismert kód vagy kártyaszám
          <input
            value={form.barcodeValue}
            onChange={(event) => handleManualCode(event.target.value)}
            disabled={isSaving}
          />
        </label>
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={() => setRecognitionState('manual')}
          disabled={isSaving}
        >
          Kód javítása
        </button>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={form.isFavorite}
          onChange={(event) => updateForm('isFavorite', event.target.checked)}
          disabled={isSaving}
        />
        Kedvenc
      </label>
      <div className="loyalty-image-previews">
        {frontPreview ? <img src={frontPreview} alt="Kártya előlapjának előnézete" /> : null}
        {backPreview ? <img src={backPreview} alt="Kártya hátlapjának előnézete" /> : null}
      </div>
      <div className="loyalty-replace-actions">
        <button type="button" onClick={() => setFormStep('front')} disabled={isSaving}>
          Előlap cseréje
        </button>
        <button type="button" onClick={() => setFormStep('barcode')} disabled={isSaving}>
          Újra beolvasás
        </button>
      </div>
      <details className="loyalty-notes">
        <summary>Jegyzetek</summary>
        <label>
          Jegyzet
          <textarea
            value={form.notes}
            onChange={(event) => updateForm('notes', event.target.value)}
            rows={3}
            disabled={isSaving}
          />
        </label>
      </details>
      <div className="loyalty-step-actions">
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={() => setFormStep('barcode')}
          disabled={isSaving}
        >
          Vissza
        </button>
        <button className="primary-button" type="submit" disabled={isSaving}>
          {isSaving ? 'Mentés...' : 'Mentés'}
        </button>
      </div>
    </section>
  )

  const activeDetailImage =
    selectedCard && showBackImage
      ? imageUrls[selectedCard.id]?.back
      : selectedCard
        ? imageUrls[selectedCard.id]?.front
        : null

  return (
    <main className="app-shell page-shell">
      <section className="loyalty-cards-panel">
        <header className="loyalty-cards-header">
          <BrandHeader section="Hűségkártyák" onHome={onOpenHome} />
          <button className="primary-button compact-button" type="button" onClick={openCreate}>
            Új kártya
          </button>
        </header>

        {message ? <p className={`message ${message.type}`}>{message.text}</p> : null}

        {isLoading ? (
          <p className="empty-state">Kártyák betöltése...</p>
        ) : cards.length === 0 ? (
          <section className="loyalty-empty-state" aria-labelledby="loyaltyEmptyTitle">
            <LoyaltyCardsIllustration />
            <div>
              <h2 id="loyaltyEmptyTitle">Még nincs elmentett kártyád.</h2>
              <p>Itt tárolhatod majd a hűség-, klub- és pontgyűjtő kártyáidat.</p>
            </div>
            <button className="primary-button loyalty-empty-action" type="button" onClick={openCreate}>
              Első kártya hozzáadása
            </button>
          </section>
        ) : (
          <>
            {favoriteCards.length > 0 ? (
              <section className="loyalty-section">
                <h2>Kedvencek</h2>
                {renderCardGrid(favoriteCards)}
              </section>
            ) : null}
            <section className="loyalty-section">
              <h2>Összes kártya</h2>
              {renderCardGrid(regularCards)}
            </section>
          </>
        )}
      </section>

      <MobileBottomNav
        activeItem="home"
        onHome={onOpenHome}
        onReports={onOpenReports}
        onAdd={onAddTransaction}
        onLists={onOpenLists}
        onProfile={onOpenProfile}
      />

      {selectedCard ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel loyalty-detail-panel" role="dialog" aria-modal="true">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Hűségkártya</p>
                <h2>{selectedCard.name}</h2>
              </div>
              <button className="secondary-button compact-button" type="button" onClick={() => setSelectedCard(null)}>
                Vissza
              </button>
            </div>
            <div className="loyalty-detail-image">
              {activeDetailImage ? (
                <img src={activeDetailImage} alt={showBackImage ? 'Kártya hátlapja' : 'Kártya előlapja'} />
              ) : (
                <span>{selectedCard.icon || '★'}</span>
              )}
            </div>
            {imageUrls[selectedCard.id]?.back ? (
              <button className="secondary-button compact-button" type="button" onClick={() => setShowBackImage((value) => !value)}>
                {showBackImage ? 'Előlap' : 'Hátlap'}
              </button>
            ) : null}
            <dl className="details-list">
              <div><dt>Szolgáltató</dt><dd>{selectedCard.provider || 'Nincs megadva'}</dd></div>
              <div><dt>Kártyaszám</dt><dd>{selectedCard.card_number || 'Nincs megadva'}</dd></div>
              <div><dt>Vonalkód érték</dt><dd>{selectedCard.barcode_value || 'Nincs megadva'}</dd></div>
              <div><dt>Jegyzet</dt><dd>{selectedCard.notes || 'Nincs megadva'}</dd></div>
            </dl>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => void handleToggleFavorite(selectedCard)}>
                {selectedCard.is_favorite ? 'Kedvenc eltávolítása' : 'Kedvencnek jelölés'}
              </button>
              <button className="primary-button" type="button" onClick={() => openEdit(selectedCard)}>
                Szerkesztés
              </button>
              <button className="secondary-button danger-button" type="button" onClick={() => void handleDelete(selectedCard)}>
                Törlés
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isFormOpen ? (
        <div className="modal-backdrop loyalty-sheet-backdrop" role="presentation">
          <section className="modal-panel loyalty-form-panel" role="dialog" aria-modal="true">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Hűségkártya</p>
                <h2>{editingCard ? 'Kártya szerkesztése' : 'Új kártya'}</h2>
              </div>
              <button className="secondary-button compact-button" type="button" onClick={closeForm} disabled={isSaving}>
                Bezárás
              </button>
            </div>
            <form className="loyalty-form" onSubmit={handleSave}>
              {renderHiddenInputs()}
              <div className="loyalty-step-indicator" aria-hidden="true">
                <span className={formStep === 'front' ? 'active' : ''}>1</span>
                <span className={formStep === 'barcode' ? 'active' : ''}>2</span>
                <span className={formStep === 'confirm' ? 'active' : ''}>3</span>
              </div>
              <p className="sr-status" aria-live="polite">
                {recognitionState === 'scanning' ? 'Vonalkód keresése...' : recognitionMessage}
              </p>
              {formStep === 'front' ? renderFrontStep() : null}
              {formStep === 'barcode' ? renderBarcodeStep() : null}
              {formStep === 'confirm' ? renderConfirmStep() : null}
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}
