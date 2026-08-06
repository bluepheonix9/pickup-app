import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'

// Game photos live in a public `game-images` bucket, one folder per user (the
// storage policies key off that folder name, so the path shape matters).
const BUCKET = 'game-images'

export type PickedImage = {
  // Local file URI — used for the preview before the upload happens.
  uri: string
  base64: string
  mimeType: string
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// Opens the system photo library. Returns null when the user backs out or
// denies access. Images are cropped to the 16:9 the game cards render at and
// compressed, so uploads stay well inside the bucket's 5 MB limit.
export async function pickGameImage(): Promise<{ image: PickedImage | null; error: string | null }> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    return { image: null, error: 'Photo access is needed to add a game photo.' }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.7,
    base64: true,
  })

  if (result.canceled || !result.assets?.[0]) return { image: null, error: null }

  const asset = result.assets[0]
  if (!asset.base64) return { image: null, error: 'Could not read that image.' }

  const mimeType = asset.mimeType && EXTENSIONS[asset.mimeType] ? asset.mimeType : 'image/jpeg'
  return { image: { uri: asset.uri, base64: asset.base64, mimeType }, error: null }
}

// base64 → bytes. Supabase Storage takes an ArrayBuffer/Uint8Array directly;
// decoding by hand avoids depending on atob or a polyfill package being present
// on every platform the app runs on.
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '')
  const byteLength = Math.floor((clean.length * 3) / 4)
  const bytes = new Uint8Array(byteLength)

  let byteIndex = 0
  let buffer = 0
  let bitsCollected = 0

  for (let i = 0; i < clean.length; i++) {
    buffer = (buffer << 6) | B64_ALPHABET.indexOf(clean[i])
    bitsCollected += 6
    if (bitsCollected >= 8) {
      bitsCollected -= 8
      bytes[byteIndex++] = (buffer >> bitsCollected) & 0xff
      // Drop the bits just consumed, so `buffer` never grows past a byte and
      // the 32-bit shift above can't overflow on a long string.
      buffer &= (1 << bitsCollected) - 1
    }
  }

  return byteIndex === byteLength ? bytes : bytes.subarray(0, byteIndex)
}

// Uploads a picked image and returns its public URL. The path is namespaced by
// user id to satisfy the storage policy, and uniquely named so replacing a
// game's photo never collides with the old one (or with another device's).
export async function uploadGameImage(
  userId: string,
  image: PickedImage,
): Promise<{ url: string | null; error: string | null }> {
  const extension = EXTENSIONS[image.mimeType] ?? 'jpg'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, base64ToBytes(image.base64), { contentType: image.mimeType, upsert: false })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
