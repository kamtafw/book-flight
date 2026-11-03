# BR-03: Seat-Service Validation

**Status:** Initial implementation on `feat/booking-br-03-seat-service-validation`; awaiting local verification and review. Not merged.
**Depends on:** BR-01 checkout contract and BR-02 offer refresh/validation.

## Purpose

Revalidate every selected seat service against fresh Duffel availability immediately before a future booking/order flow. Seat selection remains optional. If no seats were selected, validation returns `not_selected` without calling Duffel.

This is a point-in-time availability check, not a reservation or guarantee that the airline will still accept the service when an order is created. The caller should complete BR-02 offer refresh first and only run BR-03 if the offer remains usable (or a changed fare has been explicitly accepted).

## Provider contract

The documented Duffel mechanism for checking current seat availability is to retrieve the offer's seat maps again:

`GET https://api.duffel.com/air/seat_maps?offer_id={offer_id}`

The Appwrite `flight-search` function calls this endpoint using its server-side `DUFFEL_ACCESS_TOKEN` and `Duffel-Version: v2`. The response contains seat maps per segment. Seat elements contain `designator`, `disclosures`, and `available_services`; each available service contains its provider service ID, passenger ID, amount, and currency.

Duffel documents that a seat is unavailable when its `available_services` list is empty, and that a passenger can select at most one seat per segment while two passengers cannot share the same seat on a segment. See the [Duffel Seat Maps API documentation](https://duffel.com/docs/api/v2/seat-maps/get-seat-maps).

## Request

The Appwrite function accepts:

```json
{
 "action": "validate-seat-services",
 "offerId": "off_exampleOfferId",
 "selectedSeats": [
  {
   "serviceId": "ase_exampleServiceId",
   "passengerId": "pas_examplePassengerId",
   "segmentId": "seg_exampleSegmentId",
   "seatDesignator": "12A",
   "expectedAmount": "25.00",
   "expectedCurrency": "USD",
   "expectedDisclosures": []
  }
 ]
}
```

The client snapshot is untrusted comparison input only. It is never used as current provider availability or as an authoritative price. The server independently resolves the service from the fresh provider response.

## Matching algorithm

For every selected seat:

1. Find the fresh seat map matching the selected provider segment ID.
2. Find the seat element matching the selected designator.
3. Find an available service matching both the selected provider service ID and passenger ID.
4. Confirm the provider returned a valid amount, currency, and disclosure list.
5. Compare the current amount/currency with the reviewed values using decimal-string comparison.
6. Compare disclosures without relying on their order.
7. Return the fresh service and seat details for review/display.

The identity relationship is `offer → segment → seat → service → passenger`. Array positions are never used as passenger identity. The current seat name is returned as display metadata; it is not independently treated as a material change. Changed disclosures require review because they can describe eligibility or other seat restrictions.

## Response outcomes

Each submitted selection receives its own result.

| Outcome             | Meaning                                                                                                 | Client behaviour                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `valid`             | Same service remains available for the same passenger and segment, with unchanged price and disclosures | May continue to the next checkout validation       |
| `price_changed`     | Service remains available, but amount or currency changed                                               | Display fresh price and obtain explicit acceptance |
| `selection_changed` | Segment, seat, or matching service is no longer available, or disclosures changed                       | Require review/reselection                         |
| `not_selected`      | No seats were submitted                                                                                 | Skip validation and continue                       |

Top-level status precedence is:

1. `selection_changed` if any selection requires reselection/review.
2. Otherwise `price_changed` if any selection's price changed.
3. Otherwise `valid`.

A mixed response preserves all per-selection outcomes. The client must inspect every result. It must not silently drop an unavailable selection or proceed with only the selections that remain available. The traveller may remove an unavailable seat or choose another one, then validate the updated selection set again.

When a selected seat cannot be matched, its result has `current: null` and a reason such as `segment_unavailable`, `seat_unavailable`, or `service_unavailable`. Available selections return current provider details in `current`.

## Failure handling

- Invalid IDs, incomplete comparison snapshots, duplicate seat assignment on a segment, multiple seats for one passenger on a segment, or more than 60 selected seats in one request are rejected with HTTP 400.
- No selected seats returns `not_selected` before token lookup or provider fetch.
- An empty seat-map list after selections were made is a `selection_changed` result for each affected selection.
- Duffel HTTP failures, network errors, timeouts, and malformed provider responses are technical errors. They must not be presented as proof that seats are unavailable.
- Provider prices are compared as decimal strings; floating-point arithmetic is not used.
- The endpoint has a 25-second request timeout.

## Scope boundaries

Included:

- Server-side `validate-seat-services` action in the existing Appwrite function.
- Client request/response types and `validateSeatServices` API helper.
- Mocked provider tests and contract documentation.

Not included:

- Seat-selection UI redesign.
- Automatic acceptance of changed prices or disclosures.
- Payment, Duffel order creation, booking confirmation, or recovery.
- A guarantee/reservation of a seat after validation.
- Replacing BR-02 offer refresh. Offer validation and seat-service validation remain separate checks.
- A guarantee/reservation of a seat after validation.
- Replacing BR-02 offer refresh. Offer validation and seat-service validation remain separate checks.

## Verification

From the repository root:

```bash
node --test functions/flight-search/src/main.test.js
npx tsc --noEmit
npx expo lint
```

The function tests mock Duffel and do not prove live airline seat availability. A live Appwrite/Duffel smoke test remains necessary before relying on the action in a real booking flow.
