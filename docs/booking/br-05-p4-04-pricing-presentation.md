# BR-05 P4-04: Pricing Presentation and Integration

## Responsibility

P4-04 connects the verified flight offer, validated seat services, pricing domain and customer acceptance records to the Checkout Review experience. It presents the customer with a complete current price breakdown and establishes whether the customer can continue.

This checkpoint does not create an airline order, reserve seats, initiate payment or confirm a booking.

## Pricing presentation model

`src/lib/booking/readiness/checkout-pricing-presentation.ts` derives the presentation from:

- The current `FlightFareReview`.
- The current seat acceptance requirements.
- The current fare acceptance state.
- Per-seat price acceptances and disclosure acknowledgements.
- Passenger and segment labels derived from stable provider references.

The presentation uses the current refreshed fare and current provider-validated seat prices. It does not calculate totals from stale original seat prices.

The existing exact-money calculator remains the only source of arithmetic. If components use different currencies, the model returns the individual components and currencies without a combined total. If seat validation is pending or a selected seat is unavailable, the model does not produce a payable total.

The additional-services subtotal is currently zero. Additional services are not part of the supported BR-05 booking scope.

## Customer-facing Checkout Review

The screen now presents:

- Passenger names and categories.
- Supplied contact details.
- Travel-document summaries with document numbers masked.
- Every selected flight segment in sequence.
- Layover duration where adjacent provider timestamps are valid and the connecting airport matches.
- Each selected seat under its matched passenger and segment.
- Original and current flight fare when the fare changes.
- An explicit fare acceptance action for any fare amount or currency change.
- Independent price acceptance and disclosure acknowledgement for every affected seat.
- Current seat price and changed conditions.
- Flight fare, seat subtotal, additional-services subtotal and total when currencies are consistent.

A price decrease still requires explicit fare acceptance. A seat with both a price change and changed disclosures requires both independent actions. Acceptance controls become visibly complete only when the store confirms the exact current acceptance record.

## Progression gate

The Continue action is enabled only when:

1. The current passenger and booking review entry remains valid.
2. The current flight fare review exists and any changed fare is explicitly accepted.
3. Current seat validation exists and every seat requirement is satisfied.
4. No selected seat is unavailable.
5. The pricing model can calculate a single-currency total.
6. The consolidated pricing presentation reports all acceptance requirements satisfied.

The Continue handler rechecks the current store acceptance gates at press time, rather than relying only on the rendered button state.

On success, navigation goes to the existing `/payment` placeholder. That placeholder is not a payment implementation. No order creation, reservation, payment authorization or charge is performed.

## Recovery and boundaries

- Available seats with changed prices or disclosures remain in Checkout Review so the customer can accept them there.
- Unavailable seats continue to route to seat selection for replacement or removal.
- Mixed-currency pricing displays individual amounts and blocks progression.
- Unresolved provider-passenger association is explicitly flagged and blocks progression rather than allowing the customer to accept a seat price against an ambiguous passenger.
- Missing or stale fare/seat validation fails closed.
- A new offer refresh invalidates prior acceptance through the existing store lifecycle.
- Seat acceptances remain component-specific and are checked against exact current identity and values.
- BR-02 continues to own offer refresh.
- BR-03 continues to own seat-service validation. Validation is not reservation.
- BR-04 continues to own passenger information and readiness.
- BR-06 owns order preparation, payment lifecycle and booking confirmation.

## Files

- `src/lib/booking/readiness/checkout-pricing-presentation.ts`
- `src/lib/booking/readiness/checkout-pricing-presentation.test.mjs`
- `src/app/checkout-review.tsx`
- `package.json`
- `docs/booking/br-05-checkout-review.md`

## Verification

Local verification is pending. Run:

```powershell
npm run test:checkout-pricing-presentation
npm test
npx tsc --noEmit
npx expo lint
```

Manual verification should cover unchanged fare/no seats, changed fare acceptance, changed seat price acceptance, disclosure acknowledgement, combined seat price and disclosure changes, passenger/document display with masked document numbers, connecting-flight layover display, and the progression gate. A mixed-currency result may not be available from the current provider test offers; its deterministic domain test covers the no-total/blocking behaviour.
