# BR-05 P5-04: Acceptance-Criteria Audit

**Branch:** `feat/br-05-p5-03-failure-recovery`  
**Audit status:** Code-level audit complete; P5-04 local verification and manual integration matrix pending  
**Scope:** The 28 acceptance criteria in `br-05-checkout-review.md`. This audit does not authorize a merge.

## Audit method

Each criterion was checked against the Checkout Review route, passenger-readiness and booking-session domains, offer/seat review lifecycles, acceptance and pricing domains, Zustand store transitions, and the existing Appwrite Function boundary.

“Pass (code)” means the inspected implementation has a corresponding guard, domain rule, UI state or automated test. It is not a claim that the latest P5-04 code changes have passed the user's local test run. All P5-04 changes remain pending local verification.

## Acceptance-criteria matrix

| ID | Result | Implementation evidence / audit note |
| --- | --- | --- |
| BR05-01 | Pass (code) | `getCheckoutReviewEntryState()` delegates to `getBookingReadiness()`; Personal Information gates Continue to review on provider readiness; Checkout Review rechecks readiness on entry and progression. |
| BR05-02 | Pass (code, P5-04 update pending verification) | Review renders all refreshed offer segments, airport names/codes, marketing carrier and flight number, operating carrier when different, timestamps and segment duration. Provider-local wall-clock display was corrected in P5-04. |
| BR05-03 | Pass (code) | Segments are rendered independently and in sequence. Layover duration is calculated between adjacent segment timestamps only when the airport connection matches and both timestamps contain explicit timezone information. |
| BR05-04 | Pass (code, P5-04 update pending verification) | Each passenger is rendered separately with name/category, available title, gender, date of birth, nationality, contact details and ownership, document metadata, masked document number, and infant responsible-adult association. |
| BR05-05 | Pass (code) | Seat rows are joined to passengers through exact Duffel provider passenger references and to segments through segment IDs. |
| BR05-06 | Pass (code) | No-seat state is explicit; no empty passenger seat rows are rendered. A regression test covers the empty-current-selection/stale-outcome transition. |
| BR05-07 | Pass (code) | First review entry starts offer refresh. Same-session results are reused only while the provider expiry remains valid. |
| BR05-08 | Pass (code) | `unavailable` is a business outcome with a blocking screen and return-to-search action. |
| BR05-09 | Pass (code) | Material itinerary changes block progression and require a new flight selection. |
| BR05-10 | Pass (code, P5-04 update pending verification) | BR-02 comparison distinguishes material itinerary changes from harmless metadata changes. The review now renders the normalized refreshed offer so harmless descriptive updates are visible. |
| BR05-11 | Pass (code) | Seat validation starts only after a usable offer outcome; empty seat selections skip the provider validation request. |
| BR05-12 | Pass (code) | Per-selection outcomes distinguish unavailable selections with `current: null` and an explicit unavailable reason from disclosure changes with current provider data. Unavailable seats require customer resolution. |
| BR05-13 | Pass (code) | Changed seat prices are displayed and require acceptance against the exact seat-service identity and current amount/currency. |
| BR05-14 | Pass (code) | Changed flight fare shows previous/current amounts and requires explicit acceptance, including fare decreases and currency changes. |
| BR05-15 | Pass (code) | Flight fare acceptance, per-seat price acceptance and per-seat disclosure acknowledgement are independent records/actions. |
| BR05-16 | Pass (code) | Acceptance validity is checked against review/booking/offer identity and the exact component amount, currency, service and disclosure set. |
| BR05-17 | Pass (code) | Breakdown includes current flight fare, validated seat components and additional-services subtotal. The additional-services subtotal is zero because no add-ons are currently supported in BR-05 scope. |
| BR05-18 | Pass (code) | Total is calculated from current validated provider amounts using exact decimal arithmetic, not JavaScript floating-point totals. |
| BR05-19 | Pass (code) | Mixed currencies are displayed as separate components without a fabricated combined total; progression is blocked. |
| BR05-20 | Pass (code) | Technical failures remain exceptions/retry states; unavailable offers and changed itineraries are business outcomes; unavailable seats are customer-action outcomes. |
| BR05-21 | Pass (code) | Offer refresh and seat validation each enforce a maximum of three technical attempts per affected operation/review cycle, with explicit retry. |
| BR05-22 | Pass (code) | Retry exhaustion blocks progression while preserving passenger and seat draft data. |
| BR05-23 | Pass (code) | Passenger edits retain the booking/review session and passenger collection; the readiness gate is re-evaluated before continuation. |
| BR05-24 | Pass (code) | Seat validation is scoped to a canonical selected-seat snapshot. Changing a seat produces a new snapshot and invalidates reuse of the previous result. |
| BR05-25 | Pass (code) | Beginning a different offer creates a new booking session and clears dependent review lifecycles and acceptances. |
| BR05-26 | Pass (code) | Attempt IDs, session/offer identities and seat snapshot keys guard request starts, completions and failures; deferred-promise tests cover stale successes and failures. |
| BR05-27 | Pass (code) | Offer and seat lifecycle identities include review-session, booking-session and offer IDs; store transitions clear state for a new booking. |
| BR05-28 | Pass (code) | Continue rechecks current readiness and acceptance state and navigates only to the existing `/payment` placeholder. No order creation, reservation, payment authorization/capture or ticket issuance is part of the reviewed path. |

## P5-04 presentation corrections

The initial audit identified three presentation issues and the implementation branch now contains corrections:

1. **Passenger summary completeness:** display the passenger-domain identity fields that are collected, show the infant's responsible adult, and make contact ownership more explicit.
2. **Itinerary completeness:** display airport names alongside codes, segment duration and operating carrier when it differs from the marketing carrier.
3. **Refreshed provider data and local time:** render the normalized refreshed offer's descriptive itinerary data, not the original search metadata; preserve provider-local timestamp components for display instead of converting them to the device timezone.

These corrections are committed on the P5 branch but have not yet been locally verified. The current normalized `FlightSegment` contract does not expose cabin class or airline-logo assets, so those optional details are not fabricated. If these become available in the provider mapping later, the review can display them.

## Verification still required

### Automated

Run from the repository root on the P5 branch:

```powershell
npm test
npx tsc --noEmit
npx expo lint
```

### Manual integration matrix

| Scenario | Expected result | Status |
| --- | --- | --- |
| Direct flight, no seats | One segment, no layover, no empty seat rows, fare-only total; Continue opens placeholder. | Pending user verification |
| Connecting flight, no seats | Every segment and connection appears in order; layover duration is plausible and local departure/arrival times are correct. | Pending user verification |
| Connecting flight, seats on multiple segments/passengers | Every seat appears under the correct passenger and segment. | Pending user verification |
| Changed flight fare | Previous/current fare visible; progression blocked until fare acceptance. | Provider-dependent; deterministic tests cover acceptance |
| Changed seat price | Previous/current seat price visible; only that seat component requires acceptance. | Provider-dependent; deterministic tests cover acceptance |
| Changed seat disclosures | Previous/current conditions visible; acknowledgement is separate from price acceptance. | Provider-dependent; deterministic tests cover acknowledgement |
| Unavailable seat | Customer is sent to seat selection to replace/remove it; it is never silently removed. | Provider-dependent; deterministic tests cover outcome |
| Passenger edit | Passenger data is preserved; return navigation is correct; offer/seat validations are reused only when still current. | Previously manually verified; repeat in final matrix |
| Offer refresh technical failure | Explicit retries; third failure blocks progression without deleting draft. | P5-03 manually verified |
| Seat validation technical failure | Explicit retries; third failure blocks progression while successful offer validation is retained. | P5-03 manually verified |
| Payment boundary | Continue navigates to placeholder only; no order, reservation or payment action is initiated. | Pending final confirmation |

Provider-driven fare changes, seat-price changes, disclosure changes and seat unavailability may not be reproducible on demand with live inventory. Deterministic automated tests are the authoritative coverage for those outcomes; manual testing should verify the visible flow whenever the provider supplies a reproducible case.

## Closeout decision

The inspected code satisfies the acceptance criteria at the domain/store/route level, subject to the P5-04 presentation changes passing local checks and the remaining manual matrix being completed. Do not mark BR-05 fully closed or merge the branch until those checks are reported and the final diff has been reviewed.
