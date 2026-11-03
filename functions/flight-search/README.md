# Flight search Appwrite Function

This function is the server-side boundary between the Book Flight app and Duffel API v2. The mobile app calls this function; only this function reads `DUFFEL_ACCESS_TOKEN`.

## Function configuration

Create an Appwrite Function with these settings:

- **Name:** Flight Search
- **Function ID:** `flight-search`
- **Runtime:** Node.js 22 (or the newest Node runtime supported by the Appwrite project)
- **Entrypoint:** `src/main.js`
- **Root directory:** `functions/flight-search`
- **Execution timeout:** configure at least 60 seconds, where supported by the project plan. Duffel supplier search can take several seconds.
- **Build command:** no dependency installation is required; this function uses Node's built-in `fetch`

Add a function environment variable named `DUFFEL_ACCESS_TOKEN`, paste the Duffel token as its value, and mark it **Secret**. Do not add this token to Expo's `EXPO_PUBLIC_*` variables. Redeploy the function after adding or changing the secret.

## Request contract

The function accepts a JSON POST body:

```json
{
  "origin": "LOS",
  "destination": "ABV",
  "departureDate": "2027-05-21",
  "adults": 1,
  "childAges": [7],
  "infantAges": [1],
  "cabinClass": "economy"
}
```

- `origin` and `destination` are three-letter IATA airport codes.
- `departureDate` must be `YYYY-MM-DD`.
- `adults` must be an integer from 1 through 9.
- `childAges` is an optional array of ages from 2 through 11; each array entry represents one child.
- `infantAges` is an optional array of ages 0 or 1; each array entry represents one infant. Infants cannot outnumber adults.
- The total number of travellers cannot exceed 9.
- Adults are sent to Duffel as `{ "type": "adult" }`; each child and infant is sent as `{ "age": n }` so Duffel can apply its passenger-type rules.
- Legacy `children` or `infants` count fields are rejected rather than silently ignored; callers must supply the corresponding age arrays.
- `cabinClass` must be one of `economy`, `premium_economy`, `business`, or `first`.
- Live search still supports one-way trips only.

The response is `{ "offers": [...] }`. Offers are normalized by this function and include the Duffel offer ID, total fare and currency, expiry, itinerary segments, and each segment's operating-carrier name. The raw Duffel response is not passed through to the app.

## App configuration

Set these values in the app's local `.env.local` file once the Appwrite project and function exist:

```dotenv
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_appwrite_project_id
EXPO_PUBLIC_APPWRITE_FLIGHT_SEARCH_FUNCTION_ID=flight-search
```

Use the endpoint shown in your Appwrite Console if the project is self-hosted or in a different region. These three values identify the Appwrite service and function; none is the Duffel secret. Restart Expo after changing environment variables.

The function must allow execution by the intended app users. If the app has no authentication yet, allowing anonymous execution makes the search endpoint public and can expose your Duffel account to quota abuse. Treat that as development-only; before public launch, require authenticated execution and add appropriate abuse controls.

## Local function tests

From the repository root:

```bash
node --test functions/flight-search/src/main.test.js
```

These tests validate input handling and response mapping without making live Duffel requests.
