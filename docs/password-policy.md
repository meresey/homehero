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

This policy was enabled for staging on 26 September 2026.

## Production release requirement

Production Supabase project `qufmceawkyuritfyfffa` has **not** yet been changed.
When the password-policy application code is promoted to production, complete
these steps in the same release:

1. In the production Supabase dashboard, open **Authentication → Sign In /
   Providers → Email**.
2. Set **Minimum password length** to `8`.
3. Set **Password requirements** to **Lowercase, uppercase letters, digits and
   symbols (recommended)** and save.
4. Deploy the production application build.
5. Verify that a weak Party Leader password is rejected and a compliant test
   password passes client validation and reaches Supabase Auth.

Do not alter the production Auth policy before an explicitly requested
production release, and do not consider that release complete until the
dashboard settings and application behavior have both been verified.

Existing passwords are not rewritten. Supabase may require an existing user
whose password does not meet the stronger policy to reset it. Managed Hero
accounts continue to use their separate six-digit, Party Leader-controlled PIN
flow; the adult password policy does not apply to those PINs.
