
-- Add 'customer' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';

-- Access groups table
CREATE TABLE public.access_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.access_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read groups" ON public.access_groups
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert groups" ON public.access_groups
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update groups" ON public.access_groups
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete non-system groups" ON public.access_groups
FOR DELETE USING (public.has_role(auth.uid(), 'admin') AND NOT is_system);

-- Module permissions per group
CREATE TABLE public.group_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.access_groups(id) ON DELETE CASCADE NOT NULL,
  module_key text NOT NULL,
  has_access boolean DEFAULT true,
  UNIQUE(group_id, module_key)
);

ALTER TABLE public.group_module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read module permissions" ON public.group_module_permissions
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert module permissions" ON public.group_module_permissions
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update module permissions" ON public.group_module_permissions
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete module permissions" ON public.group_module_permissions
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- User group assignments
CREATE TABLE public.user_group_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  group_id uuid REFERENCES public.access_groups(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, group_id)
);

ALTER TABLE public.user_group_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assignments" ON public.user_group_assignments
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert assignments" ON public.user_group_assignments
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update assignments" ON public.user_group_assignments
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete assignments" ON public.user_group_assignments
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Seed default groups
INSERT INTO public.access_groups (name, description, is_system) VALUES
  ('Admin', 'Full platform access including administration', true),
  ('Analyst', 'Access to all intelligence and monitoring modules except administration', true),
  ('Customer', 'Access to threat map and basic threat monitoring', true);

-- Seed Admin group permissions (all modules)
INSERT INTO public.group_module_permissions (group_id, module_key, has_access)
SELECT g.id, m.key, true
FROM public.access_groups g,
LATERAL (VALUES 
  ('exposure'), ('correlation'), ('erasure'), ('investigations'),
  ('briefing'), ('chat'),
  ('heatmap'), ('social-monitor'), ('dark-web'), ('ato'), ('email'), ('stats'), ('urgent'),
  ('knowledge'), ('admin')
) AS m(key)
WHERE g.name = 'Admin';

-- Seed Analyst group permissions (everything except admin)
INSERT INTO public.group_module_permissions (group_id, module_key, has_access)
SELECT g.id, m.key, true
FROM public.access_groups g,
LATERAL (VALUES 
  ('exposure'), ('correlation'), ('erasure'), ('investigations'),
  ('briefing'), ('chat'),
  ('heatmap'), ('social-monitor'), ('dark-web'), ('ato'), ('email'), ('stats'), ('urgent'),
  ('knowledge')
) AS m(key)
WHERE g.name = 'Analyst';

-- Seed Customer group permissions (threat map only)
INSERT INTO public.group_module_permissions (group_id, module_key, has_access)
SELECT g.id, m.key, true
FROM public.access_groups g,
LATERAL (VALUES ('heatmap'), ('stats'), ('urgent')) AS m(key)
WHERE g.name = 'Customer';

-- Auto-assign existing users to groups based on their current roles
INSERT INTO public.user_group_assignments (user_id, group_id)
SELECT ur.user_id, ag.id
FROM public.user_roles ur
JOIN public.access_groups ag ON 
  (ur.role = 'admin' AND ag.name = 'Admin') OR
  (ur.role = 'analyst' AND ag.name = 'Analyst')
ON CONFLICT (user_id, group_id) DO NOTHING;

-- Function to check module access
CREATE OR REPLACE FUNCTION public.user_has_module_access(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_group_assignments uga
    JOIN public.group_module_permissions gmp ON gmp.group_id = uga.group_id
    WHERE uga.user_id = _user_id
      AND gmp.module_key = _module_key
      AND gmp.has_access = true
  )
$$;

-- Trigger for updated_at on access_groups
CREATE TRIGGER update_access_groups_updated_at
BEFORE UPDATE ON public.access_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
