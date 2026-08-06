-- Public bucket for game photos. Reads are open (game cards are public), but a
-- user may only write inside a folder named after their own auth uid, so one
-- host can't overwrite or delete another's image.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'game-images',
  'game-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Game images are publicly readable" ON storage.objects;
CREATE POLICY "Game images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'game-images');

DROP POLICY IF EXISTS "Users upload game images to their own folder" ON storage.objects;
CREATE POLICY "Users upload game images to their own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'game-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update their own game images" ON storage.objects;
CREATE POLICY "Users update their own game images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'game-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete their own game images" ON storage.objects;
CREATE POLICY "Users delete their own game images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'game-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
