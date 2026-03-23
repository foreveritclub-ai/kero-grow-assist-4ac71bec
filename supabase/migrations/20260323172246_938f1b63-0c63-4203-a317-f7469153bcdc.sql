CREATE TABLE public.diagnosis_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnosis_id uuid NOT NULL REFERENCES public.diagnosis_history(id) ON DELETE CASCADE,
  helpful boolean NOT NULL,
  user_comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.diagnosis_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback" ON public.diagnosis_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feedback" ON public.diagnosis_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);