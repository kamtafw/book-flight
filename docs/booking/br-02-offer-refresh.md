# BR-02: Offer Refresh and Validation

**Status:** Closeout implementation on `feat/booking-br-02-offer-refresh`; awaiting local verification; not merged.
**Depends on:** Accepted BR-01 contract in `docs/booking/checkout-contract.md`.

## Purpose

Re-fetch the selected Duffel offer immediately before checkout and determine whether the traveller can continue with the same offer they reviewed. This is a point-in-time validation, not a reservation and not an order-creation operation.

## Request

The Appwrite `flight-search` function accepts:

```json
{
 "action": "refresh-offer",
 "offerId": "off_exampleOfferId",
 "expectedOffer": {
  "id": "off_exampleOfferId",
  "totalAmount": "125.50",
  "totalCurrency": "USD",
  "passengers": [{ "id": "pas_example" }],
  "slices": [
   {
    "originCode": "LOS",
    "destinationCode": "ABV",
    "segments": [
     {
      "id": "seg_example",
      "departureAt": "2027-05-21T08:30:00",
      "arrivalAt": "2027-05-21T09:45:00"
     }
    ]
   }
  ]
 }
}
```

The snapshot is client-supplied and therefore untrusted. It is used only to compare what the traveller reviewed against Duffel's fresh response. It must never be used as authoritative booking or payment data. The client should preserve `priceAmount` as a decimal string from the search response.

## Validation performed

1. Require POST, a syntactically valid Duffel offer ID, and a complete expected snapshot whose ID matches the requested ID. Snapshot route codes must be three-letter uppercase IATA codes; segment IDs must be non-empty; departure and arrival values must be non-empty and parseable timestamps.
2. Call Duffel `GET /air/offers/{offer_id}` server-side using the secret Appwrite environment variable and Duffel API v2 headers.
3. Validate the returned object, matching offer ID, decimal total, ISO currency, passenger identities, itinerary structure, and a mandatory non-empty, parseable `expires_at` timestamp. Missing, null, or malformed expiry data is rejected as an invalid provider response.
4. Treat a provider 404 / recognized unavailable response, or an already-expired returned offer, as unavailable. Do not convert timeouts, provider 5xx, or malformed responses into an unavailable-flight result.
5. Compare amount and currency using decimal strings. A changed amount **or currency** requires explicit traveller acceptance.
6. Compare material itinerary fields. Descriptive provider metadata is allowed to change and is refreshed in the returned offer.

## Material versus non-material differences

The following are material and block checkout:

- Passenger provider-ID set changes.
- Slice count or slice order changes.
- Origin or destination changes for any slice.
- Segment count or segment order changes.
- Segment provider ID changes.
- Scheduled departure or arrival timestamp changes.

These changes return `status: "itinerary_changed"` with machine-readable `materialDifferences`. The client must not silently proceed using the new itinerary; the traveller must review/reselect or return to search.

The following are non-material and do not block checkout by themselves:

- Airline/carrier display names or codes.
- Airport display names.
- Marketing flight number text.
- Duration display text.
- Other descriptive metadata not used to identify the passenger, route, segment, or schedule.

The refreshed normalized offer is returned so the UI can show current provider metadata. The comparison intentionally avoids blocking checkout for harmless label changes.

## Response outcomes

- `valid`: passenger IDs, material itinerary, amount, and currency match.
- `price_changed`: only the price/currency comparison changed; explicit acceptance is required.
- `itinerary_changed`: at least one material itinerary/passenger difference exists; review/reselection is required. `priceChanged` also reports whether the fare changed.
- `unavailable`: Duffel reports the offer missing/unavailable or the returned offer is expired.
- HTTP error: malformed request (400), missing server configuration (503), provider/network failure (502), or malformed provider response (502). These are not equivalent to an unavailable offer.

## Boundaries

- No passenger personal details are accepted or processed.
- No seat services are refreshed in this task; that remains a separate BR-03 validation step when seats were selected.
- No payment, order creation, booking confirmation, or seat reservation occurs.
- A successful refresh does not guarantee availability at the later order-creation moment. Duffel's order response remains authoritative.
- The Duffel token remains server-side. No raw provider error payload or secret is returned to the client.

## Verification

From the repository root:

```bash
node --test functions/flight-search/src/main.test.js
npx tsc --noEmit
```

The Node tests cover refresh request validation, decimal comparison, harmless metadata changes, and material passenger/route/segment/schedule changes. Handler-level tests use mocked fetch responses to verify request URL, method and headers; valid refresh; currency changes; Duffel unavailable responses; provider, network and timeout failures; malformed provider data; and expiry handling. These tests do not make live Duffel requests. Live Duffel behaviour and Appwrite deployment still require environment-backed verification.
