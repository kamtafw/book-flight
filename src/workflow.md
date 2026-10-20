# Book Flight

Here are the list of things I've covered

- happy path UI for Booking form, Search results, Flight details, Seat selection, and Personal information form
- Zustand stores for flight search and flight booking

Here are my next possible options at this stage and how I rank them:

- Flight API integration -> very high PRIORITY requiring medium-high EFFORT
- Round trip -> very high PRIORITY requiring medium EFFORT
- Payment UI -> medium PRIORITY requiring medium EFFORT
- Authentication -> medium PRIORITY requiring medium EFFORT
- Multi-city -> medium PRIORITY requiring high EFFORT
- Booking history / profile -> low PRIORITY requiring medium EFFORT
- Error/loading/empty states -> high PRIORITY requiring medium EFFORT

## Flight API Integration

this should come next since the UI for the booking flow is in place; real flight result
will provide a concrete system to reason about, it will force answers to:

- What exactly constitutes a flight offer?
- How do we identify the selected flight?
- What happens when the flight price changes?
- Are seats actually available for selection?
- How do we represent airlines?
- How do we represent baggage/fare conditions?
- What does a round-trip actually look like?
- What information must survive from search all the way to booking?

I can add the error/loading/empty states to this stage since this stage will engage these states when sending back responses

I'd be using Duffel for this project cos it's a particularly good fit and their API supports the actual progression for what I'm building: **offer request -> offer -> seat maps/services -> orders -> payment**.
Duffel also explicitly models a return trip as **two slices**, and this fits nicely with the direction I'm taking.
It also provides predictable scenarios for things like:

- no flights
- connecting flights
- holdable flights
- card payment success/failure
- asynchronous booking responses

## HERE'S MY ROADMAP NOW

### Phase 1 — Real flight system

#### 1. Duffel integration

- backend/API boundary
- authentication with Duffel
- flight search
- map **Book Flight** search state to Duffel offer request
- map Duffel offers to **Book Flight** flight result model
- replace mock results

#### 2. Real selected flight

- persist selected offer
- details screen consumes actual offer
- price/availability validation

#### 3. Real seat availability

- replace the fake seat map with actual seat data where available
- retain **Book Flight** existing UI
- adapt **Book Flight** seat-selection model to the provider's seat identifiers/statuses

### Phase 2 — Complete the journey model

#### 4. Round trip

- two slices
- outbound selection
- return selection
- booking state updated for both selections
- adapt details/seat flow

#### 5. Personal information adaptation

- one passenger first
- then multiple passengers if **Book Flight** existing traveller selector supports it

### Phase 3 — Complete booking

#### 6. Payment

- booking summary
- actual total from offer/order
- payment flow
- success/failure/pending states

#### 7. Booking confirmation

- booking reference
- itinerary
- passenger
- payment/booking status

### Phase 4 — Product features

#### 8. Authentication

#### 9. Booking history/profile

#### 10. Multi-city

#### 11. Saved travellers / preferences

### Architecture

Here's my architecture:

```text
Appwrite Function = backend/API layer
Axios = mobile API client
Duffel = flight provider
```

```text
Expo / React Native
       │
       │ Axios
       ▼
Appwrite Function
       │
       │ Duffel API
       ▼
     Duffel
       │
       ▼
    Airlines
```

- Appwrite Function is sufficient at this stage since we don't require a heavy backend system for this service.
- the mobile should have no direct relationship with Duffel; it should only know about the backend contract; this prevents tight coupling between the app and the flight provider