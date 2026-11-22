# Firebase Authentication implementation plan

This document prepares the FITNESS PRO BY DANAT account feature for Firebase. It is not a substitute for configuring and testing the Firebase project.

## Intended user experience

- Do not automatically open the login screen on app launch.
- Place account registration, login and account status inside the Profile tab.
- Registration fields: username, email address, password and password confirmation.
- Login: email address and password. Username-based login requires a secure username-to-email lookup and should not expose registered email addresses.
- Require verified email before granting access to protected app features.
- Require the user to open and accept the current Terms of Use (policy version 1.0) before completing registration.
- Offer password reset by email.
- Persist authentication securely; do not store plaintext passwords.
- Provide logout and account deletion/request controls.
- When authentication is enabled, protect feature entry points and show a clear login prompt when a logged-out user tries to use a protected feature.
- Keep the policy readable from Profile after registration.

## Firebase email verification: important distinction

Firebase Authentication's standard email/password flow sends an **email verification link containing a secure action code** by calling the Firebase sendEmailVerification method. It does not natively send a user-entered six-digit numeric email OTP for the ordinary email/password registration flow.

For the first Firebase implementation, use Firebase's built-in verification link. If DANAT specifically requires a six-digit code typed into the app, implement a separate server-side one-time-code flow using a trusted Cloud Function or backend and a transactional email provider. Never generate or validate verification codes only in the client app, and never store email-provider credentials in the app or GitHub.

Official Firebase references:
- Password accounts: https://firebase.google.com/docs/auth/web/password-auth
- Verify user email: https://firebase.google.com/docs/auth/web/manage-users
- Email action links: https://firebase.google.com/docs/auth/admin/email-action-links
- Firebase security rules: https://firebase.google.com/docs/firestore/security/get-started

## Firebase project configuration required

When console access is restored:

1. Open the existing Firebase project used by FITNESS PRO BY DANAT. Do not create a duplicate project unless the owner explicitly chooses to.
2. In Authentication > Sign-in method, enable Email/Password.
3. Configure the authorized domains for the production web app and any required redirect domains.
4. Configure the email verification template, sender details and action URL.
5. Register the web app configuration and add the required Firebase public client configuration to the deployment environment. Public Firebase web configuration is not a server secret, but security rules and App Check must protect data.
6. Add Firestore only if username mapping and acceptance records are to be stored there. Enable App Check where supported.
7. Deploy restrictive Firestore security rules before writing user data.
8. Configure the app's native persistence using a secure supported persistence adapter. Never save raw passwords in AsyncStorage, SQLite or localStorage.
9. Test sign-up, verification, sign-in, password reset, logout, unverified access blocking, policy acceptance and account deletion on web and Android.

## Suggested Firestore structure

    usernames/{normalizedUsername}
      uid: string

    users/{uid}
      username: string
      email: string
      createdAt: server timestamp
      acceptedPolicyVersion: "1.0"
      acceptedPolicyAt: server timestamp
      acceptedPolicyEffectiveDate: "2026-11-22"

The username document must be claimed atomically by a trusted transaction. Normalize usernames consistently (for example, trim whitespace and lowercase) and validate allowed characters and length. Do not let a client overwrite another user's username mapping. Do not make user documents publicly readable.

The acceptance record should be written only after the authenticated user has explicitly accepted the exact policy version. Firestore rules should prevent users from changing their UID, policy version or acceptance timestamp arbitrarily. For stronger evidentiary integrity, write acceptance records through a trusted backend and retain an append-only acceptance event.

## App access gate

Do not activate a global login gate until Firebase configuration and the account flow have been deployed and verified. Enabling a gate before Firebase is configured could lock every user out of the app. Once authentication is live, centralize the access check and enforce it at every protected feature entry point, not only by hiding buttons. The login screen itself and the policy screen must remain reachable while logged out.

The app should check both:
- A valid Firebase authenticated session.
- The current user's emailVerified property is true.

A missing network connection or Firebase configuration error must not be treated as a successful login. Display a clear connection or setup message instead.

## Advertising

Authentication and AdMob are separate systems. Requiring internet access for account sign-in does not guarantee that an ad will be available or that an ad request will succeed. Do not block users solely because AdMob has no fill. Implement advertising consent and privacy disclosures required for the user's region and Google's policies.

## Release checklist

- [ ] Firebase project and app configuration confirmed.
- [ ] Email/Password provider enabled.
- [ ] Verification email template and authorized domains configured.
- [ ] Firestore username mapping and policy acceptance storage configured.
- [ ] Firestore rules reviewed and deployed.
- [ ] App Check configured where supported.
- [ ] Secure session persistence configured on web and native.
- [ ] Registration and duplicate-username handling tested.
- [ ] Unverified accounts blocked from protected features.
- [ ] Login, logout and password reset tested.
- [ ] Policy acceptance recorded with exact version and UTC timestamp.
- [ ] Logged-out feature access shows login prompt.
- [ ] AdMob consent and privacy requirements reviewed.
- [ ] Web and Android end-to-end tests passed.
