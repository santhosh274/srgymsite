
DROP POLICY "anyone can submit contact" ON public.contact_messages;
CREATE POLICY "anyone can submit contact" ON public.contact_messages
  FOR INSERT WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 100
    AND length(trim(email)) BETWEEN 3 AND 200
    AND length(trim(message)) BETWEEN 1 AND 2000
  );
