# Fitness Pro by Danat

Premium fitness and nutrition app for Android and iOS, built with Expo, React Native and TypeScript.

## Current foundation

- Premium dark interface with DANAT gold and green progress accents.
- Dashboard, food diary, progress and profile tabs.
- English, Arabic (RTL) and French language switching.
- Profile inputs and Mifflin–St Jeor BMR, TDEE, BMI, healthy-weight and macro calculations.
- Offline SQLite database for profile and weight history.
- Offline food diary with food search, user-entered foods, meal logging by gram quantity, removal of entries and daily calorie/macronutrient totals.
- SQLite schema for foods, nutrients, servings, meals, meal items, daily goals and activity logs.

## Requirements and setup

Use the Expo SDK version pinned in `package.json`, with a compatible Node.js LTS release.

```bash
npm install
npx expo start
```

If your local Expo environment reports a native package version mismatch, run:

```bash
npx expo install expo-sqlite
```

Then rebuild the native development client when using a custom development build.

## Data storage

The app stores profile and weight measurements in a local SQLite database on the device. The database is created automatically on first launch. No account or paid cloud service is required for this local MVP.

Each food record supports energy, protein, carbohydrate, total fat, fiber, sugars, starch, cholesterol, saturated/trans/mono/polyunsaturated fats, and water per 100 g. The normalized nutrient catalogue covers vitamins A, C, D, E, K and B-complex vitamins, plus calcium, iron, magnesium, phosphorus, potassium, sodium, zinc, copper, manganese, selenium, iodine, choline and fluoride. Food nutrient detail screens show the recorded values and units. Values can be entered per 100 g and scaled by serving quantity. Unknown nutrient values remain SQL NULL and display as unavailable, never as zero.\n\nUSDA FoodData Central is the planned primary source for the verified food catalogue. The app now has the schema and manual entry/detail support for the full nutrient profile, but the bulk USDA food dataset has not yet been imported; do not treat the catalogue as populated until that import is completed.

## Current development status

Implemented: app shell, dashboard UI, language switching and Arabic RTL, profile form, health calculations, SQLite schema, profile persistence and weight-history persistence.

Still to implement: import and validate the USDA FoodData Central catalogue, complete serving/category selection in the UI, expose target-versus-consumed micronutrient progress, add/edit meal entries, progress charts and reports, automated tests, and Android/iOS device verification.

## Security

Do not commit API keys, service-account files, signing credentials or production secrets.
