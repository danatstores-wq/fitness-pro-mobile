# Processing Fitness Pro account-deletion requests

The in-app request flow creates one Firestore document at `accountDeletionRequests/{uid}`. It contains the Firebase UID, account email, server timestamp, and `pending` status. The user is signed out after submission, and the app blocks a new sign-in while that request document exists.

**Before release:** publish the repository's updated `firestore.rules` in Firebase Console → Firestore Database → Rules. The app cannot submit or check deletion requests until this rule change is published.

## Manual processing checklist

1. Open Firebase Console for project `fitness-pro-by-danat`.
2. Open Firestore Database → `accountDeletionRequests`.
3. Find the request and note its `uid` and `email`. Verify the request belongs to the account before proceeding.
4. In Authentication → Users, find the same UID and delete that Firebase Authentication user.
5. In Firestore, delete the policy-acceptance document at `policyAcceptances/{uid}/versions/1.0`.
6. Delete the processed request document at `accountDeletionRequests/{uid}`. Removing this document also removes the sign-in block if the account is recreated later.
7. Send a completion confirmation to the account email address.

Use Firebase Console / an authorized administrator account for these steps. Do not ask users for their passwords.

## Local device data

When a request is submitted from inside the app, the app attempts to erase the local profile, food diary, measurements, goals, meal plans, reminders, activity logs, profile photo, user-entered foods and scanned-food cache, and cancel scheduled mobile reminders. The bundled food catalogue and translations remain so the app can open as a guest. If the user requests deletion by email from outside the app, or if local erasure fails, the user must clear the app's storage or uninstall the app. These local records are not uploaded to this Firebase project.
