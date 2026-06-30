import { supabase } from './supabase'
import type {
  CreateLoyaltyCardPayload,
  LoyaltyCard,
  UpdateLoyaltyCardPayload,
} from '../types/loyaltyCards'

const bucketName = 'loyalty-cards'
const maxImageSize = 7 * 1024 * 1024
const allowedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const getExtension = (file: File) => {
  const fileNameExtension = file.name.split('.').pop()?.toLowerCase()
  if (fileNameExtension) {
    return fileNameExtension.replace(/[^a-z0-9]/g, '') || 'jpg'
  }

  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/heic') return 'heic'
  if (file.type === 'image/heif') return 'heif'
  return 'jpg'
}

export const validateLoyaltyCardImage = (file: File) => {
  if (!allowedImageTypes.has(file.type)) {
    return 'Csak JPEG, PNG, WebP vagy HEIC képet tölthetsz fel.'
  }

  if (file.size > maxImageSize) {
    return 'A kép legfeljebb 7 MB lehet.'
  }

  return null
}

const sortCards = (cards: LoyaltyCard[]) =>
  [...cards].sort((first, second) => {
    if (first.is_favorite !== second.is_favorite) {
      return first.is_favorite ? -1 : 1
    }

    return first.name.localeCompare(second.name, 'hu-HU')
  })

export async function loadLoyaltyCards(userId: string) {
  const { data, error } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('name', { ascending: true })

  return { data: sortCards((data ?? []) as LoyaltyCard[]), error }
}

export async function loadLoyaltyCard(cardId: string, userId: string) {
  const { data, error } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('id', cardId)
    .eq('user_id', userId)
    .single()

  return { data: data as LoyaltyCard | null, error }
}

export async function createLoyaltyCard(payload: CreateLoyaltyCardPayload) {
  const { data, error } = await supabase
    .from('loyalty_cards')
    .insert(payload)
    .select('*')
    .single()

  return { data: data as LoyaltyCard | null, error }
}

export async function updateLoyaltyCard(
  cardId: string,
  payload: UpdateLoyaltyCardPayload,
) {
  const { data, error } = await supabase
    .from('loyalty_cards')
    .update(payload)
    .eq('id', cardId)
    .select('*')
    .single()

  return { data: data as LoyaltyCard | null, error }
}

export const toggleFavorite = (card: LoyaltyCard) =>
  updateLoyaltyCard(card.id, { is_favorite: !card.is_favorite })

export async function deleteLoyaltyCard(cardId: string) {
  return supabase.from('loyalty_cards').delete().eq('id', cardId)
}

export async function uploadCardImage({
  userId,
  cardId,
  side,
  file,
}: {
  userId: string
  cardId: string
  side: 'front' | 'back'
  file: File
}) {
  const validationError = validateLoyaltyCardImage(file)
  if (validationError) {
    return { path: null, error: new Error(validationError) }
  }

  const path = `${userId}/${cardId}/${side}.${getExtension(file)}`
  const { error } = await supabase.storage
    .from(bucketName)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    })

  return { path: error ? null : path, error }
}

export async function deleteStoredImages(paths: Array<string | null | undefined>) {
  const filteredPaths = paths.filter((path): path is string => Boolean(path))

  if (filteredPaths.length === 0) {
    return { error: null }
  }

  const { error } = await supabase.storage.from(bucketName).remove(filteredPaths)
  return { error }
}

export async function createSignedImageUrls(
  card: Pick<LoyaltyCard, 'front_image_path' | 'back_image_path'>,
) {
  const entries = await Promise.all(
    ([
      ['front', card.front_image_path],
      ['back', card.back_image_path],
    ] as const).map(async ([side, path]) => {
      if (!path) return [side, null] as const
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(path, 60 * 60)
      return [side, error ? null : data.signedUrl] as const
    }),
  )

  return Object.fromEntries(entries) as { front: string | null; back: string | null }
}
