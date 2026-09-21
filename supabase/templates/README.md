# Home Hero confirmation email

Subject: `Confirm your Home Hero email`

The hosted Supabase confirmation template is managed in each project's dashboard,
not by a database migration or app deployment. The HTML in
`confirm-signup.html` is the source of truth for the **Confirm sign up**
template. Preserve `{{ .ConfirmationURL }}` in both links; Supabase replaces it
with the single-use verification URL.

1. Configure the staging project (`hqwwqpnmrzonutnqlxhw`) first under
   **Authentication → Email Templates → Confirm sign up**. Paste the subject
   above and the HTML from `confirm-signup.html`.
2. Under **Authentication → URL Configuration**, verify the staging Site URL
   and redirect allow-list include `https://meresey-home-hero--staging.expo.app`.
   These were already configured when this template was prepared. The web
   sign-up flow passes its current origin as `emailRedirectTo`.
3. Send a real staging sign-up confirmation and verify that the message renders,
   the button works, and the user returns to the staging app.
4. Only after staging passes, copy the template to the separate production
   project (`qufmceawkyuritfyfffa`) and use its production URL settings.

A custom sender name and address require a verified domain and an SMTP provider
configured separately for each Supabase project. Do not commit SMTP credentials.
For new free-tier projects using Supabase's built-in email sender, template
editing is unavailable until custom SMTP is configured or the plan is upgraded.
The staging project was created after that restriction began. If it is on the
free plan and still uses Supabase's built-in sender, finish SMTP setup before
step 1. Do not use `supabase config push` to deploy this hosted template: its
preview showed a subject change but not the HTML body.
