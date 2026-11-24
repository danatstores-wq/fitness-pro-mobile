# FITNESS PRO BY DANAT

Premium fitness and nutrition app for Android and iOS, built with Expo, React Native and TypeScript.

## Current foundation

- Premium dark interface with DANAT gold and green progress accents.
- Dashboard, food diary, progress and profile tabs.
- English, Arabic (RTL) and French language switching.
- Profile inputs and Mifflin–St Jeor BMR, TDEE, BMI, healthy-weight and macro calculations.
- Offline SQLite database for profile, food catalogue, meals and weight history.
- Food search, manual food entry, meal logging by gram quantity, removal of entries and daily calorie/macronutrient totals.
- Detailed food nutrient profile per 100 g, including recorded vitamins, minerals, fatty acids and portion weights.
- USDA Foundation Foods and FNDDS catalogues bundled locally and imported into SQLite once per device.


## Firebase Authentication and AdMob

- Firebase Email/Password Authentication only. The app does not use Firestore, Realtime Database or Firebase Storage for fitness data; profile, food diary, weight history and activity data remain in local SQLite.
- Configure the GitHub Actions repository secret named `EXPO_PUBLIC_FIREBASE_API_KEY`. The Android APK, validation and GitHub Pages build workflows pass it into Expo at bundle time. The key is never committed to the repository. A client API key is included in the compiled client bundle, so apply Firebase API-key restrictions and Authentication security controls; it is not a server secret.
- For local builds, copy `.env.example` to `.env` and enter the API key locally. Do not commit `.env`.
- Email/password account creation, sign-in, password reset and a Remember me option are provided by Firebase Authentication. When Remember me is off, the session is not persisted across app/browser restarts.
- AdMob is configured with separate Android/iOS app IDs and banner/interstitial ad units. Development builds use Google's test ad units; production builds use the supplied DanatBuild units. Consent is collected through Google's UMP flow before ads are requested. Interstitials are limited to one per three minutes of foreground use.

## USDA food catalogue

The current bundled source catalogues contain:

- **424 USDA Foundation Foods** records.
- **5,432 USDA FNDDS 2021–2023** food and beverage records.
- **5,856 source records combined**, before any future cross-source deduplication.
- **353,015 detailed nutrient values** in the FNDDS catalogue.
- USDA portion weights for gram-based serving calculations.

FNDDS source: USDA FoodData Central, FNDDS 2021–2023 JSON release dated October 31, 2024. Foundation Foods are maintained as a separate USDA source. FNDDS source IDs are namespaced to prevent collisions with Foundation Foods IDs.

Official dataset information: https://fdc.nal.usda.gov/download-datasets/

Unknown nutrient values remain unknown; the importer does not invent values or replace missing data with zero. Nutrient records retain their USDA-reported names and units. The app scales nutrient amounts from the per-100-g basis to the logged gram quantity.

The FNDDS data file is gzip-compressed in the repository and decompressed only when the local catalogue needs its first import. SQLite seed markers prevent repeated imports on subsequent launches.

## Requirements and setup

Use the Node.js LTS release and package versions pinned in `package.json`.

```bash
npm install
npm run typecheck
npx expo install --check
npx expo start
```

For a physical Android or iOS device, follow Expo's development-build workflow if the selected native modules require a development client. A successful TypeScript check does not by itself mean a native device build has been completed.

## Data storage

The MVP stores profile, food catalogue, meal diary and weight measurements in a local SQLite database on the device. The local MVP does not require a paid cloud database or account service.

## Current development status

Implemented in the repository:
- Expo / React Native app shell and premium dark styling.
- English, Arabic RTL and French language switching.
- Profile form and BMI, healthy-weight range, Mifflin–St Jeor BMR, TDEE and macro calculations.
- SQLite schema and local profile / weight persistence.
- USDA Foundation Foods and FNDDS seed catalogues.
- Food search, food details, manual food creation, gram-based meal logging and daily nutrient totals.
- GitHub Actions validation for TypeScript and Expo package compatibility.

Still to complete:
- Full end-to-end testing on Android and iOS devices.
- Improve search ranking, category filters and serving selection.
- Connect dashboard calorie/macronutrient progress to the food diary.
- Add/edit existing meal entries and complete nutrient target comparisons.
- Progress charts, reports and automated functional tests.
- Future features such as barcode scanning, exercise tracking, meal plans, cloud sync and subscriptions.

## Import tooling

The repository includes `scripts/import-usda-foundation.mjs` and GitHub Actions automation for regenerating the FNDDS catalogue from the official USDA archive. The FNDDS workflow downloads the USDA 2021–2023 JSON archive, generates the compressed catalogue and commits it to this repository.

To regenerate Foundation Foods manually:

```bash
npm run import:usda -- /path/to/FoodData_Central_foundation_food_json_YYYY-MM-DD.zip
npm run typecheck
```

## Security

Do not commit API keys, service-account files, signing credentials or production secrets.
