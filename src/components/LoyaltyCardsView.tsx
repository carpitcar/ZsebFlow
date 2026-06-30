import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createLoyaltyCard,
  createSignedImageUrls,
  deleteLoyaltyCard,
  deleteStoredImages,
  loadLoyaltyCards,
  toggleFavorite,
  updateLoyaltyCard,
  uploadCardImage,
  validateLoyaltyCardImage,
} from '../lib/loyaltyCards'
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
  barcodeFormat: 'code128',
  color: '#0f766e',
  icon: '★',
  notes: '',
  isFavorite: false,
}

const barcodeFormats: Array<{ value: BarcodeFormat; label: string }> = [
  { value: 'code128', label: 'Code 128' },
  { value: 'ean13', label: 'EAN-13' },
  { value: 'ean8', label: 'EAN-8' },
  { value: 'qr', label: 'QR' },
  { value: 'other', label: 'Egyéb' },
]

const maskCardNumber = (cardNumber: string | null) => {
  const digits = cardNumber?.replace(/\D/g, '') ?? ''
  if (digits.length <= 4) return cardNumber || ''
  return `•••• ${digits.slice(-4)}`
}

const getInitialForm = (card?: LoyaltyCard | null): CardFormState =>
  card
    ? {
        name: card.name,
        provider: card.provider ?? '',
        cardNumber: card.card_number ?? '',
        barcodeValue: card.barcode_value ?? '',
        barcodeFormat: card.barcode_format ?? 'code128',
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
  const [cards, setCards] = useState<LoyaltyCard[]>([])
  const [imageUrls, setImageUrls] = useState<ImageUrls>({})
  const [selectedCard, setSelectedCard] = useState<LoyaltyCard | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<LoyaltyCard | null>(null)
  const [form, setForm] = useState<CardFormState>(emptyForm)
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [showBackImage, setShowBackImage] = useState(false)
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
    return () => {
      if (frontPreview) URL.revokeObjectURL(frontPreview)
      if (backPreview) URL.revokeObjectURL(backPreview)
    }
  }, [backPreview, frontPreview])

  const updateForm = (field: keyof CardFormState, value: string | boolean) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }))
  }

  const setImageFile = (side: 'front' | 'back', file: File | null) => {
    if (file) {
      const validationError = validateLoyaltyCardImage(file)
      if (validationError) {
        setMessage({ type: 'error', text: validationError })
        return
      }
    }

    const preview = file ? URL.createObjectURL(file) : null
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview)
      setFrontFile(file)
      setFrontPreview(preview)
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview)
      setBackFile(file)
      setBackPreview(preview)
    }
  }

  const openCreate = () => {
    setEditingCard(null)
    setForm(emptyForm)
    setFrontFile(null)
    setBackFile(null)
    setFrontPreview(null)
    setBackPreview(null)
    setMessage(null)
    setIsFormOpen(true)
  }

  const openEdit = (card: LoyaltyCard) => {
    setEditingCard(card)
    setForm(getInitialForm(card))
    setFrontFile(null)
    setBackFile(null)
    setFrontPreview(null)
    setBackPreview(null)
    setMessage(null)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
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

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saveLockRef.current || isSaving) return

    const name = form.name.trim()
    if (!name) {
      setMessage({ type: 'error', text: 'Add meg a kártya nevét.' })
      return
    }

    saveLockRef.current = true
    setIsSaving(true)
    setMessage(null)
    const uploadedPaths: string[] = []

    try {
      const basePayload = {
        name,
        provider: form.provider.trim() || null,
        card_number: form.cardNumber.trim() || null,
        barcode_value: form.barcodeValue.trim() || null,
        barcode_format: form.barcodeValue.trim() ? form.barcodeFormat : null,
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

  const renderCardGrid = (items: LoyaltyCard[]) => (
    <div className="loyalty-card-grid">
      {items.map((card) => (
        <article
          className="loyalty-card-tile"
          key={card.id}
          style={{ '--loyalty-card-color': card.color ?? 'var(--accent)' } as React.CSSProperties}
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
              {activeDetailImage ? <img src={activeDetailImage} alt="" /> : <span>{selectedCard.icon || '★'}</span>}
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
              <div><dt>Vonalkód típus</dt><dd>{selectedCard.barcode_format || 'Nincs megadva'}</dd></div>
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
        <div className="modal-backdrop" role="presentation">
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
              <label>Kártya neve<input value={form.name} onChange={(event) => updateForm('name', event.target.value)} required disabled={isSaving} /></label>
              <label>Szolgáltató<input value={form.provider} onChange={(event) => updateForm('provider', event.target.value)} disabled={isSaving} /></label>
              <label>Kártyaszám<input value={form.cardNumber} onChange={(event) => updateForm('cardNumber', event.target.value)} disabled={isSaving} /></label>
              <div className="list-form-row">
                <label>Vonalkód érték<input value={form.barcodeValue} onChange={(event) => updateForm('barcodeValue', event.target.value)} disabled={isSaving} /></label>
                <label>Vonalkód típus<select value={form.barcodeFormat} onChange={(event) => updateForm('barcodeFormat', event.target.value as BarcodeFormat)} disabled={isSaving}>{barcodeFormats.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}</select></label>
              </div>
              <div className="list-form-row">
                <label>Szín<input type="color" value={form.color} onChange={(event) => updateForm('color', event.target.value)} disabled={isSaving} /></label>
                <label>Ikon<input value={form.icon} maxLength={3} onChange={(event) => updateForm('icon', event.target.value)} disabled={isSaving} /></label>
              </div>
              <div className="list-form-row">
                <label>Előlap képe<input type="file" accept="image/*" capture="environment" onChange={(event) => setImageFile('front', event.target.files?.[0] ?? null)} disabled={isSaving} /></label>
                <label>Hátlap képe<input type="file" accept="image/*" capture="environment" onChange={(event) => setImageFile('back', event.target.files?.[0] ?? null)} disabled={isSaving} /></label>
              </div>
              {(frontPreview || backPreview) ? (
                <div className="loyalty-image-previews">
                  {frontPreview ? <img src={frontPreview} alt="Előlap előnézet" /> : null}
                  {backPreview ? <img src={backPreview} alt="Hátlap előnézet" /> : null}
                </div>
              ) : null}
              <label>Jegyzet<textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} rows={3} disabled={isSaving} /></label>
              <label className="checkbox-row"><input type="checkbox" checked={form.isFavorite} onChange={(event) => updateForm('isFavorite', event.target.checked)} disabled={isSaving} /> Kedvenc</label>
              <button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'Mentés...' : 'Mentés'}</button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}
