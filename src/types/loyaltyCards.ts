export type BarcodeFormat =
  | 'code128'
  | 'ean13'
  | 'ean8'
  | 'qr'
  | 'upca'
  | 'upce'
  | 'datamatrix'
  | 'itf'
  | 'codabar'
  | 'other'

export type LoyaltyCard = {
  id: string
  user_id: string
  name: string
  provider: string | null
  card_number: string | null
  barcode_value: string | null
  barcode_format: BarcodeFormat | null
  front_image_path: string | null
  back_image_path: string | null
  color: string | null
  icon: string | null
  notes: string | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export type CreateLoyaltyCardPayload = {
  user_id: string
  name: string
  provider?: string | null
  card_number?: string | null
  barcode_value?: string | null
  barcode_format?: BarcodeFormat | null
  front_image_path?: string | null
  back_image_path?: string | null
  color?: string | null
  icon?: string | null
  notes?: string | null
  is_favorite?: boolean
}

export type UpdateLoyaltyCardPayload = Partial<
  Pick<
    LoyaltyCard,
    | 'name'
    | 'provider'
    | 'card_number'
    | 'barcode_value'
    | 'barcode_format'
    | 'front_image_path'
    | 'back_image_path'
    | 'color'
    | 'icon'
    | 'notes'
    | 'is_favorite'
  >
>
