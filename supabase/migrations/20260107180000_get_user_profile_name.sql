-- Function to get the current user's profile display name
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion

CREATE OR REPLACE FUNCTION get_my_profile_name()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_name TEXT;
BEGIN
    SELECT p.display_name INTO v_profile_name
    FROM user_access ua
    JOIN profiles p ON p.id = ua.profile_id
    WHERE ua.user_id = auth.uid()
    LIMIT 1;

    RETURN v_profile_name;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_my_profile_name() TO authenticated;
