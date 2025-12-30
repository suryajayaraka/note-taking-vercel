-- Update user management to support admin-only user creation

-- Update the handle_new_user function to auto-approve invited users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    CASE 
      WHEN NEW.email = 'suryajayaraka@gmail.com' THEN 'admin'
      ELSE 'user'
    END,
    CASE 
      -- Auto-approve if invited by admin (has confirmation token) or is admin
      WHEN NEW.email = 'suryajayaraka@gmail.com' THEN TRUE
      WHEN NEW.invited_at IS NOT NULL THEN TRUE
      ELSE FALSE
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the simplified auth system
COMMENT ON FUNCTION public.handle_new_user() IS 
'Automatically creates user profile. Admin users and invited users are auto-approved.';
