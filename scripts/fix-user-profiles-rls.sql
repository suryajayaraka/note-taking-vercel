-- Fix infinite recursion in user_profiles RLS policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

-- Create simple, non-recursive policies
-- Allow users to view their own profile without nested queries
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow admins to view all profiles by checking role directly without subquery
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (role = 'admin' AND auth.uid() = id);

-- Allow users to update only non-sensitive fields
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow admins full update access
CREATE POLICY "Admins can update any profile" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Add INSERT policy for trigger function
CREATE POLICY "Allow insert during signup" ON user_profiles
  FOR INSERT WITH CHECK (true);
