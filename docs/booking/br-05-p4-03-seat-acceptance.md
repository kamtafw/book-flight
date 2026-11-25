# BR-05 P4-03: Seat Price Acceptance and Disclosure Acknowledgement

**Parent contract:** `docs/booking/br-05-checkout-review.md`  
**Checkpoint:** P4-03  
**Status:** Implementation pushed; local verification pending  
**Branch:** `feat/br-05-p4-03-seat-acceptance`

## Responsibility

P4-03 adds independent customer acceptance requirements for seat-service price changes and changed seat disclosures. It consumes the existing P3 seat-review outcome and does not repeat provider validation.

## Per-component identity

Every seat requirement and its acceptance are bound to:

- Checkout review session ID.
- Active booking session ID.
- Originally selected offer ID.
- Refreshed provider offer ID.
- Seat-service ID.
- Provider passenger ID.
- Flight segment ID.
- Seat designator.

No passenger or selection array position is used to identify a seat component.

## Price acceptance

- Only a P3 outcome classified as `price_changed` or `disclosures_and_price_changed` requires seat-price acceptance.
- The original selected amount/currency and current provider amount/currency are retained separately.
- Acceptance is explicit and timestamped.
- Acceptance is valid only for the exact component identity and previous/current amount/currency pair.
- A later price or currency change invalidates that component's acceptance.
- No currency conversion or floating-point arithmetic is introduced.

## Disclosure acknowledgement

- Only `disclosures_changed` or `disclosures_and_price_changed` requires acknowledgement.
- Previous and current disclosure lists are retained separately for presentation.
- Acknowledgement is independent from price acceptance. A seat with both changes requires both actions.
- Acknowledgement is bound to the exact component identity and disclosure content. Reordering the same disclosure text does not invalidate it; changed content does.
- A changed disclosure set can be acknowledged even if its current list is empty, because removal of a disclosure is still a change that must be reviewed.

## Store lifecycle

- The store keeps separate collections for seat-price acceptances and disclosure acknowledgements.
- Acceptance actions target a current component key derived from the full identity.
- Requirements are exposed only when the offer review and seat validation outcomes belong to the current review/booking session and the current selected-seat snapshot.
- A fresh offer refresh clears seat validation and all seat acceptances.
- A new booking session, abandoned/completed booking, or cleared review lifecycle also clears seat acceptances.
- A seat-only selection change does not clear unrelated acceptance records. After the new seat snapshot is validated, an acceptance remains applicable only if the exact accepted component and values are still present.
- Unavailable seats cannot be accepted and keep the seat requirements unsatisfied.

## Implementation

- `src/lib/booking/readiness/seat-acceptance.ts`
  - Builds one requirement per seat from the existing P3 outcome.
  - Creates and verifies price acceptance and disclosure acknowledgement independently.
  - Determines whether all requirements are satisfied.
- `src/lib/booking/readiness/seat-acceptance.test.mjs`
  - Covers valid seats, price changes, currency changes, disclosure changes, simultaneous changes, exact identity invalidation, disclosure ordering, unavailable seats and no-seat outcomes.
- `src/store/flight-booking.store.ts`
  - Persists per-component acceptance and exposes current requirement/action selectors.
- `src/lib/booking/readiness/seat-booking-acceptance.test.mjs`
  - Covers store integration, simultaneous requirements, preservation of unrelated accepted components, fresh-offer invalidation and unavailable seats.
- `package.json`
  - Adds focused test scripts and registers both suites in `npm test`.

## Boundaries

- No UI controls or consolidated pricing presentation; P4-04 owns those.
- No provider validation or seat reservation; P3/BR-03 owns validation, and validation is not a reservation.
- No payment processing or order creation; those remain outside BR-05.
