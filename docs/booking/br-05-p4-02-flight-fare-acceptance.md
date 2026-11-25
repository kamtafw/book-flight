# BR-05 P4-02: Flight Fare Comparison and Acceptance

**Parent contract:** `docs/booking/br-05-checkout-review.md`  
**Checkpoint:** P4-02  
**Status:** Implementation pushed; local verification pending  
**Branch:** `feat/br-05-p4-02-flight-fare-acceptance`

## Responsibility

P4-02 defines the provider-independent domain contract for comparing the originally selected flight fare with the refreshed provider fare and recording explicit acceptance when the fare changes. It does not add checkout UI or payment/order behaviour.

## Comparison rules

- Compare the exact decimal amount strings and currency codes, not the display-formatted amount or the legacy numeric `FlightOffer.price`.
- An identical amount and currency is unchanged and requires no acceptance.
- Any amount change requires acceptance, whether the fare increases or decreases.
- Any currency change requires acceptance, even if the numeric amount happens to be identical.
- When both fares use the same currency, calculate the difference as current minus previous using the exact-money helpers from P4-01.
- When currencies differ, do not calculate or imply a converted difference. Preserve both original amounts and currencies; the pricing model will prevent a combined total across mixed currencies.

## Acceptance identity

A fare acceptance is bound to all of the following:

- Checkout review session ID.
- Active booking session ID.
- Originally selected offer ID.
- Refreshed provider offer ID.
- Previous amount and currency.
- Exact current amount and currency.

An acceptance is current only while every value above matches. A new review/booking session, different selected or refreshed offer, changed comparison baseline, or any change to the current amount/currency invalidates the prior acceptance.

Acceptance is explicit and timestamped. The domain does not infer acceptance from navigation, screen visibility, or a button press unrelated to the current fare review.

## Implementation

- `src/lib/booking/readiness/flight-fare-review.ts`
  - `createFlightFareReview()` produces either `unchanged` or `acceptance_required`.
  - `acceptFlightFareChange()` records acceptance only for a changed fare.
  - `isFlightFareAcceptanceCurrent()` verifies the acceptance against the exact current review.
- `src/lib/booking/readiness/flight-fare-review.test.mjs`
  - Covers unchanged fares, increases, decreases, currency changes, exact acceptance identity, invalidation, malformed money, and invalid timestamps.
- `package.json`
  - Adds `npm run test:flight-fare-review` and includes the suite in `npm test`.

## Boundaries

- No UI integration in this checkpoint; P4-04 owns consolidated pricing presentation and acceptance controls.
- No seat-service acceptance or disclosure acknowledgement; P4-03 owns those.
- No order creation, payment processing, or reservation behaviour; those remain outside BR-05.
