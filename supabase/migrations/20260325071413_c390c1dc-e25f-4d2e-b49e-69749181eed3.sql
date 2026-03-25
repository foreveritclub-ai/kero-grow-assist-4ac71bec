
-- Community Q&A tables
CREATE TABLE public.community_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  crop_name text,
  votes integer NOT NULL DEFAULT 0,
  answers_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.community_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.community_questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  votes integer NOT NULL DEFAULT 0,
  is_accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.community_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_id uuid REFERENCES public.community_questions(id) ON DELETE CASCADE,
  answer_id uuid REFERENCES public.community_answers(id) ON DELETE CASCADE,
  vote_type smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id),
  UNIQUE(user_id, answer_id)
);

-- RLS
ALTER TABLE public.community_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_votes ENABLE ROW LEVEL SECURITY;

-- Questions: anyone authenticated can read all, insert own, update own, delete own
CREATE POLICY "Anyone can read questions" ON public.community_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own questions" ON public.community_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own questions" ON public.community_questions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own questions" ON public.community_questions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Answers: same pattern
CREATE POLICY "Anyone can read answers" ON public.community_answers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own answers" ON public.community_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own answers" ON public.community_answers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own answers" ON public.community_answers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Votes
CREATE POLICY "Anyone can read votes" ON public.community_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own votes" ON public.community_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.community_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_community_questions_updated_at BEFORE UPDATE ON public.community_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
