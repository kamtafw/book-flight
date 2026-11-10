# BR-04D: Booking Readiness and Passenger Information Lifecycle Contract

**Status:** Draft for review  
**Branch:** `docs/booking-br-04d-contract`  
**Depends on:** BR-04A passenger domain model, BR-04B multi-passenger UI, BR-04C Duffel-aware passenger validation, BR-02 offer refresh/validation, BR-03 seat-service validation  
**Scope:** Derive a clear pre-order readiness result and define explicit passenger-information lifecycle/cleanup behavior  
**Explicitly excludes:** Order creation, payment, booking confirmation, persistent passenger storage, saved traveller profiles, and unrelated search/seat changes

## 1. Purpose

BR-04D closes the passenger-information milestone by answering two questions:

1. Is the active passenger collection sufficiently complete and valid for the next **order-preparation** stage?
2. When should passenger information and booking-specific seat selections be preserved or cleared?

This milestone introduces a booking-level readiness result and explicit lifecycle operations. It does not submit an order, reserve seats, authorize payment, or confirm a booking.

## 2. Approved decisions

### D1. What counts as abandonment?

**Approved rule:** Navigating backwards within the active booking flow is not abandonment.

Preserve the current passenger collection and selected seat choices when the user moves between:

- flight details;
- seat selection;
- passenger information;
- any other screen explicitly belonging to the same active booking session.

Treat the current booking session as abandoned when the user:

- explicitly cancels/abandons the booking;
- leaves the booking flow for the home or search flow;
- starts a different booking session.

Do not infer abandonment from a screen unmount, component cleanup, or ordinary `router.back()` navigation. Screen lifecycle is not a reliable signal of user intent.

Starting a new booking must not reuse passenger information or seat selections from the previous booking, even if the new booking happens to contain the same travellers or flight.

### D2. What gets cleared?

**Approved rule:** On abandonment or completion, clear:

- the active passenger collection, including personal identity, contacts, travel documents, provider references, and passenger relationships;
- booking-specific outbound seat selections/services and seat designators.

Preserve:

- search criteria;
- search results;
- cached flight offers.

Do not clear unrelated search state merely because a booking session ended.

The cleanup operation must be explicit, centralized, and safe to call more than once. It must not log passenger or travel-document values.

## 3. Readiness semantics

### 3.1 Result contract

Introduce a booking-level result with these semantics:

```ts
type BookingReadinessStatus = "incomplete" | "ready_for_order_preparation"

interface BookingReadinessIssue {
 code: string
 message: string
 passengerId?: string
 field?: string
}

interface BookingReadinessResult {
 status: BookingReadinessStatus
 offerId: string
 passengerStatus: PassengerValidationStatus
 issues: BookingReadinessIssue[]
}
```

Names may be refined to fit existing conventions, but the meanings must remain explicit.

- `incomplete`: the selected offer or active passenger collection is missing, mismatched, or not `provider_ready` under BR-04C.
- `ready_for_order_preparation`: the active passenger collection is `provider_ready` for the exact selected offer, and the collection maps one-to-one to that offer's passengers.

The result must identify the offer it was evaluated against. A result for one offer must never be treated as valid for another offer.

### 3.2 What readiness does and does not mean

`ready_for_order_preparation` means only that the client-side passenger information checks currently pass for the selected offer.

It does **not** mean:

- Duffel has accepted the passenger data;
- the offer is still available or its price is unchanged;
- selected seats remain available or their services/prices are unchanged;
- seats have been reserved;
- an order can safely be submitted without further server checks;
- payment is authorized, captured, or complete;
- a booking is confirmed.

Before any future order-creation request:

1. Revalidate/refresh the offer server-side using the BR-02 boundary.
2. If seat selections exist, revalidate every selected seat/service server-side using the BR-03 boundary. If no seats are selected, seat validation remains optional and must not block order preparation.
3. Reconcile the passenger collection against the exact current offer passenger IDs and current provider requirements.
4. Build the order payload server-side from validated provider data and the approved passenger domain model.

These checks are future order-preparation/order-creation responsibilities. BR-04D must not implement them as a new booking write path.

### 3.3 Seat selection and readiness

Seat selection remains optional.

- A passenger collection can be `ready_for_order_preparation` with no selected seats.
- Existing selected seats may remain in the active session, but BR-04D must not claim that they are currently valid or reserved.
- The readiness result must communicate, where useful, that selected seats require fresh BR-03 validation before a future order request.
- Do not silently remove unavailable or changed seats as part of readiness calculation.

### 3.4 Evaluation and staleness

Readiness must be derived from the current selected offer and current passenger collection, using the BR-04C validator. Prefer a pure function over storing a separately mutable readiness flag.

If the selected offer changes, the passenger collection is absent, the collection is reinitialized for a different offer, or passenger data changes, the readiness result must be recalculated. Do not retain a previous `ready_for_order_preparation` result as authoritative.

If the current state cannot be evaluated safely, return `incomplete` with a non-sensitive actionable issue. Do not allow an exception or missing value to become a passing result.

## 4. Booking-session lifecycle

Model the lifecycle explicitly rather than tying it to React component mount/unmount.

Conceptual transitions:

```text
No active booking
      |
      | select an offer / begin booking
      v
Active booking
      |
      +---- navigate within booking flow ----> Active booking (preserve data)
      |
      +---- edit passenger information ------> Active booking (recalculate readiness)
      |
      +---- select a different offer/session -> New active booking (clear old booking data)
      |
      +---- abandon / leave for home-search --> No active booking (clear booking data)
      |
      +---- booking completed (future flow) --> No active booking (clear booking data)
```

Requirements:

- Beginning a booking session must establish which offer/session owns the passenger collection and seat selections.
- Re-entering passenger information for the same active offer/session must preserve existing passenger data.
- Back/forward navigation within the same session must preserve data.
- Starting a different booking must clear old passenger and booking-specific seat data before initializing the new session.
- Abandonment and completion must invoke the same centralized cleanup behavior.
- Cleanup must be idempotent.
- Do not clear data just because a component unmounts or a route is temporarily left.
- Do not introduce a general-purpose navigation framework or refactor unrelated routes.

If the existing app cannot reliably distinguish leaving the booking flow from navigating within it, implement the smallest explicit route/action boundary needed. Document any route whose intent remains ambiguous rather than guessing.

## 5. State ownership and implementation boundaries

Keep passenger information in the existing in-memory booking store. No persistence middleware or device storage is to be added.

Expected responsibilities:

- **Passenger domain/validation layer:** remains responsible for the BR-04A domain and BR-04C provider-aware passenger validation.
- **Booking readiness layer:** combines the exact selected offer identity and passenger validation result into the BR-04D readiness result. Keep it pure and independently testable where practical.
- **Booking store:** owns the active passenger collection and explicit lifecycle actions. It may expose a single cleanup action that clears passenger information and associated booking-specific seat selections.
- **Screens/routes:** invoke lifecycle actions only at explicit session boundaries. Ordinary back navigation preserves state.

Do not duplicate passenger validation rules in the UI or store. Do not store a readiness boolean that can become stale independently of its inputs.

## 6. Cleanup contract

Provide one centralized action or equivalent operation for ending an active booking session.

On abandonment or completion, it must:

- clear `passengerCollection`;
- clear outbound selected seat services and seat designators associated with that booking;
- clear any newly introduced booking-session identity/readiness state, if such state is added;
- leave search criteria, search results, and cached offers unchanged.

On starting a different booking session, perform the same booking-specific cleanup before initializing the new offer's passenger collection.

It must not:

- clear search criteria/results/offers;
- clear unrelated app state;
- write passenger data to persistent storage;
- log or emit passenger/travel-document values;
- clear data during an ordinary in-flow back action.

No completed-booking state currently exists. Implement the cleanup operation so a future confirmed-completion flow can call it, but do not invent a booking-completion screen or confirmation flow in this milestone.

## 7. Sensitive-data handling

- Passenger identity, contact and travel-document values remain in memory only.
- Do not add AsyncStorage, SecureStore, localStorage, persisted Zustand middleware, saved traveller profiles, or automatic passenger-data retention.
- Do not include sensitive passenger values in logs, analytics, errors, readiness issues, or debug output.
- Cleanup must remove the active passenger collection from the booking store.
- Do not claim that clearing Zustand memory securely erases all copies from process memory; this milestone defines application-state lifecycle, not forensic memory sanitization.

## 8. Acceptance criteria

- [ ] A typed booking-readiness result distinguishes `incomplete` from `ready_for_order_preparation`.
- [ ] Readiness is tied to the exact selected offer ID and its passenger identities.
- [ ] Readiness is incomplete when the selected offer or passenger collection is absent or mismatched.
- [ ] Readiness is incomplete unless BR-04C reports `provider_ready`.
- [ ] Readiness is recalculated when offer/passenger inputs change; no independently stale readiness flag is trusted.
- [ ] A ready result explicitly does not imply offer validity, seat availability/reservation, order submission, payment, or booking confirmation.
- [ ] No-seat bookings can still become ready.
- [ ] Selected seats are marked as requiring fresh BR-03 validation before any future order request; BR-04D does not claim they are valid.
- [ ] Back/forward navigation within the same booking flow preserves passenger data and selected seats.
- [ ] Screen unmount alone never clears passenger data.
- [ ] Explicit abandonment and leaving the booking flow for home/search clear passenger data and booking-specific seat selections.
- [ ] Starting a different booking clears old passenger and booking-specific seat data before initializing the new session.
- [ ] Abandonment/completion cleanup is centralized and idempotent.
- [ ] Cleanup preserves search criteria, search results, and cached offers.
- [ ] The cleanup operation is ready for a future completion flow to call, without implementing that flow now.
- [ ] Passenger data remains in memory only; no persistence or saved profiles are introduced.
- [ ] No sensitive passenger/document values are logged or included in issues.
- [ ] Existing BR-02 offer mapping/refresh, BR-03 seat identity mapping, and BR-04A/B/C behavior remain intact.
- [ ] No order creation, payment, booking confirmation, unrelated route refactor, or form redesign is introduced.

## 9. Test plan

At minimum, cover:

**Readiness**

- provider-ready passenger collection for the exact offer → ready;
- draft or locally-valid collection → incomplete;
- missing offer;
- missing passenger collection;
- offer ID mismatch;
- missing/extra/mismatched provider passenger identity;
- passenger changes cause readiness to be recalculated;
- offer changes cannot reuse prior readiness;
- validator/evaluation failure returns incomplete;
- no selected seats does not block readiness;
- selected seats do not make the result claim they are validated or reserved.

**Lifecycle and cleanup**

- same-session reinitialization preserves passenger edits;
- ordinary back/forward navigation preserves passenger and seat state;
- screen unmount does not clear passenger data;
- explicit abandonment clears passenger collection and selected outbound seat services/designators;
- leaving booking flow for home/search invokes cleanup;
- starting a different booking clears old booking data before new initialization;
- completion cleanup can call the same operation (unit-level behavior only; no completion UI);
- cleanup is safe when called repeatedly or when no session exists;
- search criteria, search results, and cached offers remain unchanged after cleanup.

**Privacy**

- no passenger/document values appear in readiness issues or test diagnostics;
- no persistence middleware/storage is introduced.

## 10. Implementation sequence

After this contract is approved:

1. Audit the latest `main` route graph and booking-store actions to identify exact explicit entry, in-flow navigation, abandonment, and new-session boundaries.
2. Implement and test the pure booking-readiness result.
3. Implement the centralized, idempotent booking-session cleanup/start behavior.
4. Wire only the explicit route/action boundaries needed to preserve in-flow navigation and clear on abandonment/new session.
5. Run focused tests, existing passenger-domain/validation tests, flight-search tests, TypeScript, and Expo lint.
6. Review the diff for accidental persistence, sensitive logging, unrelated route changes, and any claim that readiness equals booking confirmation.

Do not create the implementation branch or modify application code until this contract is reviewed and explicitly approved.

## 11. Non-goals

- Duffel order payload construction or order creation.
- Payment provider selection or payment processing.
- Booking confirmation, cancellation with an airline, or order recovery.
- Seat reservation or long-lived seat holds.
- Persistent passenger data or saved traveller profiles.
- Immigration/visa advice or route-specific passport validity rules.
- Reworking the passenger form or search/seat flows beyond the minimum lifecycle wiring.
