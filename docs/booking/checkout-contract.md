# Booking Checkout Contract (BR-01)

**Status:** Proposed contract for review  
**Scope:** One-way Duffel flight booking, including optional selected seats  
**Implementation status:** Documentation only. No booking, payment, or order-creation code is implemented by this checkpoint.

## 1. Purpose

Define the data and validation boundary between the Book Flight app and its server-side Appwrite Function before implementing checkout.

The mobile app must not call Duffel directly or hold the Duffel access token. Appwrite remains the trusted boundary for provider requests, validation, price calculation, order creation, and provider error normalization.

This contract is for the current supported journey: one-way flight search with adults, children, and infants. It does not imply that round trips or multi-city booking are supported.

## 2. Existing state and constraints

The current app already has:

- Duffel offers normalized into `FlightOffer`, including offer ID, total price/currency, expiry, slices/segments, and provider passenger IDs/types/ages.
- Seat maps fetched for an offer through the existing `flight-search` Appwrite Function.
- Seat selections stored with the offer ID, service ID, passenger ID, segment ID, seat designator, displayed price/currency, and disclosures.
- One shared `passengerInformation` object, which is not sufficient for multiple travellers.
- A placeholder payment screen. There is no implemented order-creation/booking-confirmation flow.

Seat selection is a user preference only. It does not reserve a seat or guarantee that the selected service remains available.

## 3. Proposed checkout input contract

The client should submit a booking intent to Appwrite. The client must not submit provider credentials, decide the authoritative amount to charge, or send a provider order payload that the server blindly forwards.

Conceptual request (field names are illustrative until the implementation task defines the TypeScript types):

```ts
interface BookingIntent {
  offerId: string;
  passengers: PassengerDetails[];
  selectedSeats: SelectedSeatIntent[];
  contact: BookingContact;
  expectedOfferPrice?: {
    amount: string;
    currency: string;
  };
}

interface PassengerDetails {
  offerPassengerId: string;
  givenName: string;
  familyName: string;
  bornOn: string; // YYYY-MM-DD
  title?: string;
  gender?: string;
  email?: string;
  phoneNumber?: string;
  // Additional fields only when required by Duffel/the validating airline.
}

interface SelectedSeatIntent {
  serviceId: string;
  offerPassengerId: string;
  segmentId: string;
  seatDesignator: string;
}

interface BookingContact {
  email: string;
  phoneNumber?: string;
}
```

### Contract rules

- `offerId` must be a valid provider offer ID and must identify the selected offer.
- `offerPassengerId` must match one of the passengers belonging to the refreshed offer. Array position is not an identity.
- Passenger details must cover every passenger on the offer exactly once; no missing, duplicate, or foreign passenger IDs.
- Passenger ages/types must remain consistent with the search request and offer passenger records. Date of birth is validated against the passenger's provider/search age category, with edge cases resolved using the airline/provider's requirements rather than assuming the UI category is authoritative.
- `selectedSeats` may be empty because seat selection is optional. If present, every entry must be validated against the current seat-map response for the same offer, passenger, and segment.
- Do not trust client-submitted seat prices, offer prices, currency, seat designators, or disclosures as authoritative booking data. They are useful for review/UI and mismatch detection only.
- `expectedOfferPrice` is an optional comparison value, not an amount to charge. If the refreshed offer price differs, checkout must return a price-change state and require explicit traveller acceptance before proceeding.
- Contact details are separate from passenger details. Do not assume the lead passenger is necessarily the booking contact.
- Do not log names, dates of birth, passport details, contact information, payment credentials, or full booking payloads.

This is a conceptual contract, not yet a committed application type or an exact provider payload.

## 4. Server-side validation and refresh sequence

The booking-readiness path must execute in this order:

1. **Validate request shape.** Reject malformed IDs, missing required fields, duplicate passenger IDs, invalid dates, and unsupported booking scope.
2. **Retrieve the offer from Duffel.** Use the provider's single-offer endpoint to obtain current offer data. The original search result and its `expiresAt` field are not sufficient evidence of current availability.
3. **Validate the refreshed offer.** Confirm the offer is still usable, contains the expected passenger identities and itinerary, and has a valid total amount/currency. Compare its price with the client review value and require explicit confirmation if it changed.
4. **Refresh seat-map data when seats were selected.** Retrieve seat maps for the current offer and verify each requested service ID is still offered for the exact passenger and segment. Verify the current service price/currency and seat designator from provider data. Do not rely on the old client-side seat-map state.
5. **Build a provider request from trusted data.** Use the refreshed offer and service IDs, validated passenger details, and server-calculated amount. Never copy a client-supplied total into the provider payment payload.
6. **Return a clear pre-booking result.** The client must be able to distinguish valid-to-continue, price-changed, seat-changed/unavailable, expired/unavailable offer, invalid passenger data, and provider/network failure.

A successful refresh is not a guarantee that the offer or seats will remain available until order creation. Duffel remains the final authority; order-creation errors must also be handled safely.

## 5. Seat services and totals

For Duffel order creation, a selected seat is represented by its current service ID and quantity `1`. The service ID is passenger-specific, so it must be checked against the intended offer passenger. The UI's seat designator is for display and verification; it is not a substitute for the service ID.

The total to show during review should be derived from current provider data:

- Current offer total, including its included flight price.
- Plus each selected seat service's current total amount, where those services are priced separately.
- With currency consistency checked before summing. Do not add unlike currencies or silently substitute missing prices.

The order response's final amount is authoritative. If the provider's pricing/payment flow yields a different total, the app must not present the old review total as the amount successfully charged.

Do not assume all offers treat seat services identically. Follow Duffel's current offer/service requirements, including any `intended_services` constraint returned by the provider.

## 6. Order creation and payment are a separate decision gate

BR-01 does **not** choose or implement the payment model.

Duffel supports different order flows depending on offer payment requirements, including instant payment at order creation and eligible hold orders that are paid later. We must choose the intended customer experience and payment integration before defining the final order-creation request.

Before implementing order creation, decide and document:

- Whether this MVP supports instant payment only or eligible hold orders as well.
- Which payment method/provider the app will use and how payment credentials/tokens are handled.
- Whether the payment flow can safely be completed through Duffel's supported payment model for the account and target market.
- How pending, failed, successful, and uncertain payment outcomes are represented.
- How retries avoid accidentally creating duplicate bookings or charging twice.

Do not collect raw card details into Zustand or general application state. Do not mark a booking confirmed just because an order-creation request was sent; confirmation must be based on the provider's authoritative response/status.

## 7. Booking lifecycle states

The UI/API boundary should support at least these distinct states:

- `needs_passenger_details`
- `validating`
- `offer_price_changed`
- `offer_unavailable`
- `seat_selection_changed`
- `passenger_validation_failed`
- `ready_for_payment`
- `creating_order`
- `payment_pending`
- `booking_confirmed`
- `booking_failed`
- `booking_status_unknown`

These are conceptual product states, not a required literal enum. In particular, `booking_status_unknown` is needed for timeouts or connection loss where the client cannot tell whether the provider completed the operation. Recovery should query/reconcile provider state rather than blindly repeating order creation.

## 8. Data ownership

| Data | Authority | Client responsibility |
| --- | --- | --- |
| Offer ID | Duffel | Preserve the selected ID; never invent one. |
| Current itinerary, price, currency, expiry | Refreshed Duffel offer | Display and ask for acceptance if price changes. |
| Passenger IDs | Refreshed offer | Map each form to the correct provider passenger ID. |
| Passenger personal details | Traveller, validated against provider requirements | Collect only required fields; validate format and completeness. |
| Seat service ID and price | Fresh Duffel seat-map/service response | Preserve the intended choice; do not treat it as reserved. |
| Final order total/status/reference | Duffel order response/status | Display only after checking the authoritative result. |
| Payment outcome | The chosen payment/provider flow, reconciled with order status | Show accurate pending/success/failure states; don't infer success from a client redirect. |

## 9. Acceptance criteria for BR-01

- [ ] The client-to-Appwrite booking-intent shape is documented.
- [ ] Passenger identity uses provider passenger IDs, never array position.
- [ ] Passenger details and booking contact are separate concepts.
- [ ] Seat selection is optional and seat service IDs are passenger/segment-specific.
- [ ] The server refreshes the offer and selected seat services before booking.
- [ ] Price changes require explicit acceptance; missing prices are never treated as zero.
- [ ] The server calculates totals from current provider data and validates currency consistency.
- [ ] Payment model and order flow remain an explicit decision before implementation.
- [ ] Provider errors and uncertain outcomes are represented without falsely confirming a booking.
- [ ] Duffel credentials remain server-side in Appwrite.

## 10. References

- Duffel, [Get a single offer](https://duffel.com/docs/api/v2/offers): retrieve the current offer before booking; price and available service information may change.
- Duffel, [Creating orders](https://duffel.com/docs/api/v2/orders): order creation requires the selected offer, passenger details, and payment/hold information appropriate to the offer.
- Duffel, [Adding seats](https://duffel.com/docs/guides/adding-seats): use current passenger-specific seat service IDs and quantity `1`; the payment amount must account for selected services.

These provider references should be rechecked when implementing BR-02 onward because API requirements can change.
