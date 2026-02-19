
-- Investigation tickets table for tracking analyst efforts across all feed items
CREATE TABLE public.investigation_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id text NOT NULL UNIQUE, -- Human-readable ID like LRX-00001
  -- Polymorphic reference to any feed item
  source_type text NOT NULL, -- 'threat', 'threat_news', 'ato_event', 'social_ioc', 'breach_check'
  source_id uuid NOT NULL,
  -- Ticket metadata
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open', -- open, in_progress, escalated, resolved, closed
  priority text NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  assigned_to uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  -- Tracking
  notes jsonb DEFAULT '[]'::jsonb, -- Array of {text, author, timestamp}
  tags text[] DEFAULT '{}'::text[],
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sequence for human-readable ticket IDs
CREATE SEQUENCE public.ticket_seq START 1;

-- Function to auto-generate ticket_id on insert
CREATE OR REPLACE FUNCTION public.generate_ticket_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_id IS NULL OR NEW.ticket_id = '' THEN
    NEW.ticket_id := 'LRX-' || LPAD(nextval('public.ticket_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_ticket_id
  BEFORE INSERT ON public.investigation_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ticket_id();

-- Auto-update updated_at
CREATE TRIGGER update_investigation_tickets_updated_at
  BEFORE UPDATE ON public.investigation_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.investigation_tickets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read tickets
CREATE POLICY "Authenticated users can view tickets"
  ON public.investigation_tickets FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can create tickets
CREATE POLICY "Authenticated users can create tickets"
  ON public.investigation_tickets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update tickets they created or are assigned to, admins can update all
CREATE POLICY "Users can update relevant tickets"
  ON public.investigation_tickets FOR UPDATE
  USING (
    auth.uid() = created_by 
    OR auth.uid() = assigned_to 
    OR has_role(auth.uid(), 'admin')
  );

-- Only admins can delete tickets
CREATE POLICY "Admins can delete tickets"
  ON public.investigation_tickets FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_tickets_source ON public.investigation_tickets(source_type, source_id);
CREATE INDEX idx_tickets_status ON public.investigation_tickets(status);
CREATE INDEX idx_tickets_assigned ON public.investigation_tickets(assigned_to);
CREATE INDEX idx_tickets_created_by ON public.investigation_tickets(created_by);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.investigation_tickets;
