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

The normal search response is `{ "offers": [...] }`. Offers are normalized by this function and include the Duffel offer ID, total fare and currency, expiry, itinerary segments, and each segment's operating-carrier name. The raw Duffel response is not passed through to the app.

## Offer-refresh request contract

The same function accepts an offer-refresh action before checkout:

```json
{
  "action": "refresh-offer",
  "offerId": "off_exampleOfferId",
  "expectedOffer": {
    "id": "off_exampleOfferId",
    "totalAmount": "125.50",
    "totalCurrency": "USD",
    "passengers": [{ "id": "pas_example" }],
    "slices": [{
      "originCode": "LOS",
      "destinationCode": "ABV",
      "segments": [{
        "id": "seg_example",
        "departureAt": "2027-05-21T08:30:00",
        "arrivalAt": "2027-05-21T09:45:00"
      }]
    }]
  }
}
```

The `expectedOffer` is the snapshot the traveller reviewed. It is untrusted comparison input only; it is never used as current provider data or as a price to charge. Preserve the provider's decimal `priceAmount` string from search results rather than converting the numeric display price back to a string.

The function calls Duffel's `GET /air/offers/{offer_id}` endpoint and normalizes the fresh response. It returns one of these business outcomes:

- `{ "status": "valid", "offer": ... }`: price, passenger identities, and material itinerary details still match. Updated non-material metadata (for example, carrier display names) is returned in the refreshed offer.
- `{ "status": "price_changed", "previousPrice": ..., "currentPrice": ..., "offer": ... }`: the amount or currency changed. The client must show the new price and obtain explicit acceptance before proceeding.
- `{ "status": "itinerary_changed", "materialDifferences": [...], "priceChanged": ..., "offer": ... }`: passenger IDs, slice count/order, route, segment count/order/IDs, or scheduled departure/arrival timestamps changed. Do not silently continue with the changed itinerary; require the traveller to review and reselect/restart the journey.
- `{ "status": "unavailable", "code": "OFFER_NO_LONGER_AVAILABLE" | "OFFER_EXPIRED", ... }`: Duffel reports the offer missing/unavailable, or the returned offer is already expired. The client must send the traveller back to search.

Material itinerary changes block checkout. Non-material descriptive metadata changes do not: the refreshed metadata is returned for display. Price comparison uses decimal strings, not floating-point arithmetic. HTTP/provider/network failures are returned as errors (for example, `DUFFEL_OFFER_REFRESH_FAILED` or `DUFFEL_OFFER_REFRESH_UNAVAILABLE`) and must not be presented as an unavailable flight.

This refresh is a point-in-time validation, not a reservation or guarantee that the offer remains available until order creation. Duffel's order response remains authoritative. No passenger personal details, payment data, or order is created by this action.

## Seat-map request contract

The same function accepts a seat-map action, keeping the Duffel credential server-side:

```json
{
 "action": "seat-map",
 "offerId": "off_exampleOfferId"
}
```

The function calls Duffel's `GET /air/seat_maps?offer_id=...` endpoint and returns `{ "seatMaps": [...] }`. The normalized response preserves each seat map's segment/slice IDs, cabins, rows, sections, element types/designators, disclosures, and passenger-specific available services (service ID, passenger ID, amount, and currency). These service IDs are needed for a future order request; the app must not treat a selected seat as booked.

An empty `seatMaps` array is a valid response and means seat selection is unavailable for that offer. Seat maps are provider-dependent and may be returned per itinerary segment. The client should allow travellers to continue without choosing a seat. A seat is selectable for a given traveller only when its `availableServices` contains a service for that passenger ID. Prices and service IDs must come from the current seat-map response.

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
