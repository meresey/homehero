# Home Hero confirmation email runbook

This runbook is for the Supabase **Confirm sign up** email sent to Party Leaders.
The subject is `Confirm your Home Hero email`; the message body is
[`confirm-signup.html`](./confirm-signup.html). The HTML is committed, but it is
**not live** merely because the app is deployed. Hosted Supabase email settings
are separate from Expo deployments and database migrations.

## Current status (21 September 2026)

- The branded HTML and subject are ready in this directory.
- Staging uses Supabase project `hqwwqpnmrzonutnqlxhw`; production uses
  `qufmceawkyuritfyfffa`.
- Staging's Site URL and redirect allow-list already include
  `https://meresey-home-hero--staging.expo.app`.
- No Home Hero sending domain or SMTP provider has been selected. The hosted
  confirmation template has **not** been changed in either project.
- The staging project was created after Supabase's 3 June 2026 free-tier
  restriction. If it is on the Free plan and uses the default sender, custom
  templates require custom SMTP first. A paid plan can unlock template editing
  with the default sender, but does not provide a Home Hero sender address.

## Prerequisites

1. Choose a domain owned by Home Hero (an existing domain is fine) and a
   transactional email provider that offers SMTP. Use a sender such as
   `no-reply@auth.yourdomain.com` and display name `Home Hero`.
2. Verify the sending domain with the provider. Add its required DNS records,
   including SPF and DKIM; configure DMARC for deliverability.
3. Obtain the provider's SMTP host, port, username, and password. Enter the
   password only into the Supabase dashboard or another approved secret store.
   Never commit it, put it in an Expo public environment variable, or share it
   in chat.

## Apply and test on staging first

1. In the **staging** Supabase project, open **Authentication → SMTP Settings**.
   Enable custom SMTP and enter the provider's host, port, username, password,
   sender address, and sender name `Home Hero`. Save and confirm Supabase accepts
   the settings. If the project is on a paid plan, the SMTP step may be deferred
   for testing the HTML, but it remains necessary for a branded sender and
   reliable public email delivery.
2. Open **Authentication → Email Templates → Confirm sign up**. Set the subject
   to `Confirm your Home Hero email` and paste the entire contents of
   [`confirm-signup.html`](./confirm-signup.html) as the body. Keep every
   `{{ .ConfirmationURL }}` placeholder intact: Supabase substitutes the
   single-use verification link. Save the template.
3. Under **Authentication → URL Configuration**, re-check the staging Site URL
   and redirect allow-list. The web sign-up call in `src/AuthFlow.tsx` supplies
   its current origin as `emailRedirectTo`, so the staging alias must be allowed.
4. Create a fresh Party Leader account at
   `https://meresey-home-hero--staging.expo.app`. Check the sender name and
   address, subject, mobile and desktop rendering, button, fallback link, and
   return to staging after confirmation. Confirm the account can sign in. Test
   password reset separately; it uses a different Supabase email template.
5. Record the test date and outcome before changing production. If delivery
   fails, inspect Supabase Auth logs and the provider's delivery logs; check DNS,
   SMTP credentials, provider restrictions, and Supabase email rate limits.

## Promote to production

Only after staging succeeds, repeat the SMTP, template, and redirect setup in
the **production** Supabase project. Use the real production app URL, not the
staging alias, for its Site URL and redirect allow-list. Send a fresh production
test email and verify its destination. Do not assume an Expo deploy or database
migration copies these settings between projects.

If the new message fails, restore the previous subject/body in the affected
project's Email Templates page. Keep SMTP enabled if disabling it would stop
delivery to real users.

## References

- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Free-tier template restriction](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier)

Do not use `supabase config push` to deploy this hosted HTML template. The CLI
configuration preview showed a subject update but did not include the body.
