# Password policy

Party Leader accounts use Supabase email/password authentication. New passwords
must contain:

- at least 8 characters;
- at least one lowercase letter;
- at least one capital letter;
- at least one number; and
- at least one symbol. The app highlights the common safe set
  `!@#$%^&*._-`.

The signup form validates these rules before making an Auth request. Supabase
Auth must enforce the matching server-side policy so API clients cannot bypass
the form. In the project dashboard, open **Authentication → Sign In / Providers
→ Email**, set the minimum password length to `8`, choose **Lowercase, uppercase
letters, digits and symbols (recommended)**, and save.

This policy was enabled for staging on 26 September 2026. Apply the same setting
to production only as part of an explicitly requested production release.

Existing passwords are not rewritten. Supabase may require an existing user
whose password does not meet the stronger policy to reset it. Managed Hero
accounts continue to use their separate six-digit, Party Leader-controlled PIN
flow; the adult password policy does not apply to those PINs.

