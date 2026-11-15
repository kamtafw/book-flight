# Book Flight

## Project Scope & V1 Definition

**Document version:** 1.0  
**Status:** Working baseline  
**Product:** Book Flight  
**Release target:** V1

---

## 1. Product Overview

### 1.1 Product Vision

Book Flight is a flight-booking application that enables users to discover and compare available flights, make informed booking decisions, complete flight reservations, and manage their travel bookings from one place.

The product aims to provide a reliable, transparent, and straightforward flight-booking experience, covering the journey from flight discovery to successful booking confirmation and ticket retrieval.

### 1.2 Target Market

Book Flight will initially optimize for Nigerian customers while supporting international travel.

The application should accommodate:

- Domestic flight bookings within Nigeria.
- International flight bookings originating from Nigeria.
- International itineraries between other supported destinations.
- Customers booking flights for themselves or other travellers.

**Market positioning:** Nigeria-first, internationally capable.

### 1.3 Intended Customers

Book Flight should accommodate three primary customer scenarios:

1. Individuals booking flights for themselves.
2. Individuals booking flights for family members, friends, or other people.
3. Individuals booking flights on behalf of colleagues or groups.

The application should support these scenarios without becoming a corporate travel management platform.

---

## 2. Product Principles

The following principles govern product development and feature decisions.

1. **Functional completeness over feature abundance:** Prioritize capabilities necessary to fulfil the product's primary purpose.
2. **Reliability over sophistication:** A simple feature that works consistently is more valuable than an elaborate feature that introduces unnecessary complexity.
3. **Transaction integrity:** Payment, booking confirmation, and ticket issuance must be handled reliably.
4. **Pricing transparency:** Customers should understand the price, applicable fees, and booking conditions before committing.
5. **Customer accountability:** Every booking and payment attempt should have an identifiable and explainable outcome.
6. **Provider-aware functionality:** The application must respect the capabilities and limitations of its external service providers.
7. **Extensibility without over-engineering:** Accommodate reasonable future expansion without implementing features prematurely.
8. **Defined completion:** Every capability should have identifiable acceptance criteria and a verifiable completion state.

---

## 3. Product Capability Domains

### 3.1 Flight Discovery and Search

Users should be able to discover flights that meet their travel requirements.

**Capabilities:**

- One-way flight search.
- Round-trip flight search.
- Multi-city flight search.
- Multiple passenger types (adults, children, and infants).
- Flight search results.
- Flight comparison.
- Filtering and sorting.
- Flight details and complete itineraries.
- Airline and flight information.
- Fare information and restrictions.
- Baggage allowance information.
- Flight offer validity and freshness validation.

### 3.2 Booking Preparation

Users should be able to prepare their selected flights for booking.

**Capabilities:**

- Passenger information collection.
- Multiple passenger management.
- Passenger-specific information and travel documents.
- Passenger-provider identity mapping.
- Infant-to-adult relationship management.
- Passenger information validation.
- Optional seat selection.
- Additional service selection where supported.
- Booking information validation.
- Fresh validation of selected flights and additional services.

### 3.3 Booking and Payment

Users should be able to complete their selected flight bookings.

**Capabilities:**

- Final booking review.
- Transparent price breakdown.
- Booking readiness validation.
- Payment initiation and processing.
- Payment verification.
- Booking/order creation.
- Booking confirmation.
- Electronic ticket issuance.
- Ticket retrieval.
- Booking references and receipts.
- Payment and booking failure handling.
- Duplicate transaction protection.
- Transaction recovery and reconciliation.

**Note:** Detailed payment architecture, payment-provider selection, and booking lifecycle implementation will be defined in a separate technical discussion before payment integration.

### 3.4 Booking Management

Users should be able to retrieve and access their existing bookings.

**Capabilities:**

- Upcoming bookings.
- Past bookings.
- Booking details.
- Complete flight itineraries.
- Passenger information.
- Ticket information and retrieval.
- Booking references.
- Applicable fare conditions and restrictions.
- Booking status information.
- Access to customer support for booking-related issues.

### 3.5 Travel Assistance

Users should receive essential information relevant to their journeys.

**V1 considerations:**

- Access to booking and itinerary information.
- Access to issued tickets.
- Visibility of relevant travel conditions.
- Basic assistance for booking-related issues.

More advanced travel assistance will be deferred.

### 3.6 Account and Customer Management

Users should have a persistent customer identity and access to their booking history.

**Capabilities:**

- Account registration and authentication.
- Account management.
- Saved traveller profiles.
- Booking history.
- Customer and booking ownership association.
- Secure session management.
- User preferences.

Account registration will be optional under the current proposed direction, with support for guest checkout.

Guest bookings must still have a reliable customer contact identity and a secure means of subsequent retrieval.

---

## 4. V1 Product Scope

V1 is intended to deliver a functional flight-booking product covering the complete primary booking journey.

The following capabilities are mandatory for V1 completion.

| Domain                | V1 requirements                                                    |
| --------------------- | ------------------------------------------------------------------ |
| Flight discovery      | Search, compare, filter, sort, and select flights.                 |
| Booking preparation   | Collect and validate passenger information.                        |
| Passenger management  | Support multiple passengers and relevant passenger relationships.  |
| Additional services   | Support optional seat selection and appropriate validation.        |
| Booking review        | Present accurate itinerary and pricing information.                |
| Payment               | Process and verify payments through a supported provider.          |
| Booking creation      | Successfully create and confirm airline reservations.              |
| Ticket issuance       | Obtain and provide access to issued tickets.                       |
| Booking retrieval     | Allow customers to retrieve and view existing bookings.            |
| Account management    | Support customer identity and booking ownership.                   |
| Transaction integrity | Handle payment and booking failures safely.                        |
| Customer assistance   | Provide a reasonable route for resolving booking-related problems. |

### 4.1 Primary User Journey

V1 must support the following journey:

1. A customer opens Book Flight.
2. The customer searches for available flights.
3. The customer compares available options.
4. The customer selects a preferred flight.
5. The customer provides passenger information.
6. The customer selects optional services where available.
7. The customer reviews the booking and final price.
8. The customer proceeds with payment.
9. The application verifies payment and completes the booking process.
10. The airline reservation is confirmed.
11. The ticket is successfully issued.
12. The customer receives access to their booking reference and ticket.
13. The customer can return later to retrieve their booking.

The application must also account for foreseeable failures throughout this journey.

### 4.2 Definition of a Successful Booking

A successful booking requires both:

- A confirmed airline reservation.
- Successful ticket issuance.

Payment success alone does not constitute a successful booking.

Similarly, successful reservation creation without ticket issuance must not be presented as a completed booking.

The application must communicate intermediate states accurately.

---

## 5. Transaction Integrity and Reliability

Transaction integrity is a mandatory V1 product requirement.

The application must account for situations where payment, booking creation, and ticket issuance do not complete as expected.

The following scenarios must be addressed:

| Scenario                                        | Required product behaviour                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Payment succeeds but booking creation times out | Preserve the transaction and establish the actual booking outcome before retrying.      |
| Payment succeeds but airline rejects booking    | Record the failure and initiate the appropriate refund process.                         |
| Customer closes the application during payment  | Allow the transaction to continue and reconcile independently of the customer's device. |
| Booking succeeds but ticket retrieval fails     | Preserve the booking and retry ticket retrieval without creating another reservation.   |
| Flight price changes before confirmation        | Present the updated price and obtain customer acceptance before proceeding.             |

Additional requirements:

- Persistent transaction records.
- Unique transaction references.
- Payment verification.
- Duplicate processing protection.
- Booking status tracking.
- Recovery and reconciliation mechanisms.
- Refund initiation and tracking for unsuccessful bookings where payment was collected.
- Clear customer communication.
- A support escalation route for unresolved cases.

Detailed implementation contracts for these requirements will be established separately.

---

## 6. V1 Exclusions and Deferred Capabilities

The following capabilities are not prerequisites for V1 completion.

| Capability                                               | Classification     |
| -------------------------------------------------------- | ------------------ |
| Self-service booking cancellation                        | Deferred           |
| Self-service refund requests for voluntary cancellations | Deferred           |
| Booking modifications                                    | Deferred           |
| Advanced flight status tracking                          | Deferred           |
| Automated check-in                                       | Deferred           |
| Digital boarding pass generation                         | Deferred           |
| Predictive fare pricing                                  | Future enhancement |
| Automated fare alerts                                    | Future enhancement |
| Loyalty and rewards programmes                           | Future enhancement |
| AI-powered travel recommendations                        | Future enhancement |
| Hotel reservations                                       | Future enhancement |
| Car hire and airport transfers                           | Future enhancement |
| Automatic disruption rebooking                           | Future enhancement |
| Social trip planning                                     | Future enhancement |
| Advanced travel analytics                                | Future enhancement |
| Multi-provider flight inventory expansion                | Future enhancement |

These classifications do not mean the capabilities are unimportant.

They simply aren't necessary to establish a complete V1 flight-booking product.

---

## 7. Explicit Product Boundaries

Book Flight V1 is not intended to:

- Operate an independent airline reservation or inventory management system.
- Build its own payment processing infrastructure.
- Own airline check-in infrastructure.
- Guarantee airline services that its providers do not support.
- Become a comprehensive travel marketplace.
- Implement every airline-specific ancillary service.
- Provide corporate travel management functionality.
- Support every possible airline and payment provider from inception.

The application will depend on appropriate external providers for flight inventory, reservations, payment processing, and other supported services.

Its responsibility is to integrate these services into a consistent and dependable customer experience.

---

## 8. Non-Functional Expectations

In addition to its functional capabilities, Book Flight should satisfy the following quality expectations.

| Area            | Expectation                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------- |
| Reliability     | Critical booking operations should behave predictably and recover safely from failures.       |
| Security        | Customer, passenger, and payment-related information must be appropriately protected.         |
| Performance     | Search and booking interactions should remain responsive under reasonable network conditions. |
| Data integrity  | Booking and transaction records must remain consistent.                                       |
| Usability       | Primary booking journeys should be understandable without requiring technical knowledge.      |
| Connectivity    | The application should handle unstable network conditions gracefully.                         |
| Maintainability | The codebase should remain understandable and reasonably easy to extend.                      |
| Scalability     | Architecture should accommodate reasonable increases in users and transactions.               |
| Accessibility   | Important interactions should be accessible and usable across supported devices.              |

---

## 9. V1 Completion Criteria

Book Flight can be considered a complete V1 product when the following conditions are satisfied.

### Flight Discovery

- Users can search for one-way, round-trip, and multi-city flights.
- Users can search with supported passenger combinations.
- Users can compare and select available flights.
- Flight details and important fare conditions are accessible.

### Booking Preparation

- Users can provide information for multiple passengers.
- Passenger information is appropriately validated.
- Relevant passenger relationships are supported.
- Optional seat selection works where available.
- Selected services are validated before booking.

### Booking and Payment

- Users can review their complete booking before payment.
- Pricing is presented accurately.
- Payment can be initiated and verified.
- Bookings can be successfully created.
- Confirmed reservations result in issued tickets.
- Failed and uncertain transactions are handled safely.

### Booking Management

- Customers can retrieve their bookings.
- Customers can access their booking details and itineraries.
- Customers can retrieve issued tickets.
- Booking information remains accessible after leaving and reopening the application.

### Reliability

- Duplicate payment and booking operations are appropriately prevented.
- Network interruptions do not silently destroy transaction state.
- Payment and booking outcomes can be reconciled.
- Failed bookings involving collected payments have an appropriate refund process.
- Customers receive meaningful information about unresolved transactions.

### Overall Product Completion

The product must successfully support the complete primary user journey:

**Search → Compare → Select → Prepare → Review → Pay → Confirm → Issue Ticket → Retrieve Booking.**

The journey must be verified through integration and end-to-end testing, including relevant failure scenarios.

A feature is not considered complete simply because its interface exists or its happy path works.

---

## 10. Feature Evaluation and Scope Governance

This document serves as the authoritative reference for evaluating new feature ideas.

Every new feature proposal should be assessed against the following questions:

1. What customer problem does this feature solve?
2. Which existing capability domain does it belong to?
3. Is it necessary to fulfil the product's primary purpose?
4. Does it address reliability, security, compliance, or transaction integrity?
5. Does it introduce a new product responsibility?
6. What are its implementation and maintenance implications?
7. What happens if it is deferred?

### Feature Classification

#### A. V1 Requirement

Necessary to fulfil the primary product purpose or satisfy essential reliability, security, or compliance requirements.

#### B. V1 Quality Improvement

Improves an existing mandatory capability without introducing an unnecessary new product responsibility.

#### C. Future Enhancement

Valuable but not necessary for V1 completion.

#### D. Out of Scope

Does not align sufficiently with the product vision or intended direction.

Only categories A and B qualify for active V1 development consideration.

Categories C and D should not interrupt ongoing V1 work unless an explicit scope revision is approved.

### Scope Revision

The product scope may evolve when new information reveals a genuine requirement.

However, changes must be deliberate.

Any proposed scope change must explain:

- The reason for the change.
- The customer or business value.
- Its impact on existing requirements.
- Whether it changes the V1 completion criteria.

Approved changes must be reflected in the document's version history.

---

## 11. Definition of Product Success

Book Flight V1 succeeds when customers can confidently discover, select, purchase, and retrieve flight bookings without uncertainty about their selected flights, prices, payments, reservations, or tickets.

The product should fulfil this purpose reliably before expanding into additional travel services.

**The objective is not to build the flight-booking application with the most features. It is to build a flight-booking application that customers can depend on.**# Book Flight

