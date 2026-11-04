# BR-04: Passenger Information Contract

**Status:** Approved design direction; implementation not started  
**Scope:** Provider-agnostic passenger domain model and passenger-information collection for the current one-way booking flow  
**Depends on:** BR-01 checkout contract, BR-02 offer refresh/validation, BR-03 seat-service validation  
**Explicitly excludes:** Order creation, payment processing, booking confirmation, saved-traveller profiles, and persistent passenger-data storage  

## 1. Purpose

Replace the current single-passenger information object with a model that represents every traveller on a selected offer without depending on a screen, form layout, or one flight provider.

The model represents a traveller's identity and personal details, contact methods, travel documents, provider passenger identity for the selected offer, and relationships between passengers (especially an infant and the responsible adult).

Provider- and airline-specific rules belong in a requirements/adapter layer. They must not be encoded as universal assumptions in the core passenger model.

This contract covers passenger information and booking readiness only. Local validity or provider readiness is not order creation, seat reservation, payment success, or booking confirmation.

## 2. Current state

The app already collects adult, child, and infant counts/ages during search; receives provider passenger IDs, types, and ages in the normalized offer; and uses provider passenger IDs for seat selection. It currently has one generic `passengerInformation` object and a single-passenger screen.

BR-04 must consume the existing search and seat identity foundations, not recreate them or infer provider identities from array positions.

## 3. Domain model boundaries

### 3.1 Internal passenger identity

Each passenger has an app-generated stable internal ID. It identifies the traveller within the active booking flow. It is not a Duffel ID and must not be derived from list index, display order, or form position.

Illustrative TypeScript shape (implementation may refine names and exact types while preserving these semantics):

```ts
type InternalPassengerId = string

interface Passenger {
 id: InternalPassengerId
 identity: PassengerIdentity
 contacts: PassengerContact[]
 travelDocuments: TravelDocument[]
 providerReferences: ProviderPassengerReference[]
}

interface PassengerIdentity {
 givenName?: string
 middleName?: string
 familyName?: string
 title?: string
 gender?: string
 dateOfBirth?: string // YYYY-MM-DD
}

interface PassengerContact {
 id: string
 type: "email" | "phone"
 value: string
 belongsTo: "passenger" | "other"
 relatedPersonPassengerId?: InternalPassengerId
}

interface TravelDocument {
 id: string
 type: string
 documentNumber?: string
 issuingCountry?: string // ISO 3166-1 alpha-2 where applicable
 expirationDate?: string // YYYY-MM-DD
}

interface ProviderPassengerReference {
 provider: string
 offerId: string
 providerPassengerId: string
}

interface PassengerRelationship {
 passengerId: InternalPassengerId
 relatedPassengerId: InternalPassengerId
 type: "responsible_adult"
}
```

This is a semantic contract, not a requirement to copy the illustrative interfaces verbatim. Optional fields are intentional: the model must represent drafts while requirements are still being determined.

### 3.2 Provider identity mapping

For the selected offer:

- Every provider passenger maps to exactly one internal passenger record.
- Every internal passenger in the active booking collection maps to exactly one passenger identity for that offer.
- Preserve the provider passenger ID exactly as returned.
- Scope the mapping by provider and offer ID. Never reuse a passenger ID from another offer without reconciliation.
- Never infer mapping from array position, passenger label, age order, or screen order.
- Missing, duplicate, or foreign provider references make the collection invalid for readiness.

Internal IDs connect app-owned passenger data and relationships. Provider IDs identify the traveller in provider requests and seat services.

If the user selects a different offer, reconcile the passenger collection against that offer's passenger identities. Do not assume IDs from the previous offer remain valid.

### 3.3 Passenger relationships and infants

Represent relationships using internal passenger IDs, independently of UI controls.

For an infant requiring a responsible adult:

- The relationship points from the infant to the responsible adult.
- Both passengers must exist in the active collection and map to the same selected offer.
- The responsible passenger must qualify as an adult under the selected provider's requirements.
- Provider-specific constraints, including whether one adult may be responsible for multiple infants, belong in the adapter/requirements layer.
- The Duffel adapter translates the relationship using exact provider passenger IDs. For Duffel this includes setting the responsible adult's `infant_passenger_id` to the infant's provider passenger ID where required.
- Do not store provider-specific field names in the core relationship model.

Do not assume all providers have identical infant-adult rules.

### 3.4 Passenger contact versus booking contact

Passenger contact details and booking contact details are separate concepts and separate data.

Do not silently copy the booking contact, a parent's/guardian's contact, or another passenger's contact into a passenger's own contact fields. Do not represent another person's contact as belonging to the passenger.

The model may explicitly represent a related person's contact where a use case requires it, including whose contact it is. The provider adapter determines whether that value satisfies provider requirements.

Current Duffel booking requirements indicate passenger email and phone details are required for the relevant order flow. Where Duffel requires the passenger's own details and those are unavailable, that passenger remains incomplete for Duffel readiness. Do not fabricate values or silently substitute booking-contact details.

Booking contact is a separate booking-level model and is not part of the passenger identity record.

### 3.5 Travel documents

Support multiple travel documents per passenger, including document type, number, issuing country, expiration date, and additional provider-required attributes.

Travel-document fields are not universally mandatory. Whether a document is required, which types are accepted, and which attributes are needed depend on provider, airline, route, passenger, and itinerary requirements.

Do not require passport details for every passenger or itinerary by default. Do not assume nationality and document-issuing country are interchangeable; model nationality separately if it is required.

Travel-document values are sensitive personal data. Do not log them, persist them in general app storage, or include them in diagnostics/error messages.

## 4. Provider requirements and adapter boundary

The core passenger model describes information; it does not dictate provider rules.

A provider-specific requirements/adapter layer is responsible for:

- Declaring required, optional, and conditional fields for a provider and booking context.
- Validating provider-specific formats and allowed values.
- Applying age/category and infant relationship constraints.
- Determining whether travel documents are required.
- Mapping internal field names and values into provider payload fields.
- Translating internal relationships into provider-specific relationship fields.
- Reporting missing or invalid fields in a structured, user-actionable way.

Evaluate requirements for the selected offer and booking context. Do not put Duffel-specific requirements into the general `Passenger` interface or make the screen the authority on requirements.

For Duffel, map internal date of birth to the provider's expected field (for example, `born_on`), use the exact provider passenger ID from the selected offer, and map contact, identity-document, and infant relationship fields according to the current API contract.

Adapters must not invent missing values. If a required value is absent, report the passenger as not ready.

## 5. Validation and readiness

Keep three concepts distinct:

1. **Draft** — the passenger record exists and information is being collected; it may be incomplete.
2. **Locally valid** — values satisfy app-level structural/basic format checks and internal references/relationships are consistent.
3. **Provider-ready** — the selected provider's currently known requirements for this offer and booking context are satisfied.

Provider-ready is not provider acceptance, order creation, seat reservation, payment success, or booking confirmation.

Validation returns structured issues, not just a boolean. Each issue identifies the affected internal passenger, field where applicable, issue category, and an actionable explanation. Distinguish at least missing required information, invalid format/value, invalid or duplicate provider mapping, age/category inconsistency, invalid infant relationship, missing provider-required document, and missing provider-required passenger contact.

The UI may present validation issues but does not own the rules. Screen changes must not change the meaning of readiness.

Age/category validation uses the selected offer's provider passenger identity/type/age together with search data and date of birth. Do not assume UI labels override provider passenger records. Handle provider/airline age-boundary rules in the adapter.

## 6. Data lifecycle and privacy

For this milestone:

- Hold passenger data in memory in the booking flow.
- Do not add AsyncStorage, local-storage, database persistence, or saved-traveller profiles.
- Keep data available while navigating between booking screens in the active flow.
- Clear passenger information when the booking flow is explicitly abandoned or completed.
- Do not clear passenger information merely because the user navigates backward within the active flow.
- Do not log passenger identity, contact, travel-document values, or full passenger payloads.
- Keep sensitive values out of analytics, crash reports, URLs, and debug output.

In-memory-only storage means data may be lost if the app process is terminated. This is an accepted limitation for BR-04; do not add persistence as a workaround.

Cleanup must be explicit and testable. Identify the abandonment/completion boundary and reset passenger data without unintentionally clearing unrelated search or offer state.

## 7. UI responsibilities

The passenger-information UI is a presentation/data-entry layer over the domain model. It must:

- Render the complete passenger collection from the selected offer.
- Associate each form with the correct internal passenger ID.
- Display passenger category/type from selected-offer/search context.
- Collect each passenger's own details without using screen order as identity.
- Explain known provider-required contact/document information.
- Allow users to understand and correct validation issues.
- Collect infant-responsible-adult relationships where applicable.
- Avoid making optional travel documents appear universally mandatory.
- Prevent unrestricted skip from being treated as booking readiness.

The UI must not generate provider IDs, define provider validation rules, or treat form submission as order creation/booking confirmation. Passenger data that must survive navigation belongs in the booking-flow domain/store, not only component state.

## 8. BR-04 stages

| Stage  | Deliverable                                                                                |
| ------ | ------------------------------------------------------------------------------------------ |
| BR-04A | Provider-agnostic passenger domain model, provider references, and passenger relationships |
| BR-04B | Multi-passenger information UI driven by the domain model                                  |
| BR-04C | Provider-aware validation, including conditional requirements and infant responsibility    |
| BR-04D | Booking-readiness result, in-memory lifecycle, and cleanup                                 |

Stages may be implemented in bounded passes, but must preserve this contract. No order or payment work is included.

## 9. Acceptance criteria

- [ ] Every passenger returned for the selected offer has exactly one internal passenger record.
- [ ] Every internal passenger maps to exactly one provider passenger identity for the active offer.
- [ ] Provider passenger IDs are preserved exactly and never inferred from array positions.
- [ ] Adults, children, and infants are represented independently of UI structure.
- [ ] Infant/responsible-adult relationships use internal IDs and are translated by the provider adapter.
- [ ] Provider-specific passenger rules are not hardcoded into the core model.
- [ ] Passenger contact is separate from booking contact.
- [ ] Another person's contact is never silently represented as the passenger's own.
- [ ] Travel documents are supported but not universally mandatory.
- [ ] Nationality and document-issuing country are distinct when both are collected.
- [ ] Draft, locally valid, and provider-ready are distinct states.
- [ ] Validation issues identify the affected passenger/field and provide actionable feedback.
- [ ] Provider-ready does not imply provider acceptance or booking confirmation.
- [ ] Passenger data survives navigation within the active flow.
- [ ] Passenger data is not persisted beyond the in-memory flow in this milestone.
- [ ] Abandonment/completion cleanup is explicit and tested.
- [ ] Sensitive passenger values are not logged or unnecessarily exposed.
- [ ] Existing search and seat-selection behavior remains intact.
- [ ] Tests cover mapping, duplicate/missing identities, categories, infant relationships, conditional requirements, documents, and cleanup.
- [ ] No order creation, payment processing, or booking confirmation is introduced.

## 10. Test expectations

Automated tests should cover:

- Mapping every selected-offer passenger to one internal record.
- Missing, duplicate, foreign-offer, and mismatched provider references.
- Stable internal identity independent of list ordering.
- Adult, child, and infant passenger records.
- Infant relationship validity and provider-specific responsible-adult constraints.
- Passenger contact versus booking contact separation and explicit ownership of related-person contact.
- Optional versus conditionally required travel documents.
- Provider requirement evaluation without changing the core model.
- Draft/local-valid/provider-ready transitions and structured validation issues.
- In-memory state surviving screen navigation.
- Explicit cleanup on abandonment/completion.
- Regression of existing offer and seat-selection passenger-ID associations.

## 11. Non-goals and later decisions

Not part of BR-04:

- Provider order creation.
- Payment provider selection, payment credentials, charging, refunds, or payment status.
- Booking confirmation, ticketing, cancellation, or booking recovery.
- Saved traveller profiles, account-linked passenger records, or persistent passport storage.
- Round-trip/multi-city passenger lifecycle changes unless separately scoped.
- Deciding how a minor without individual contact details satisfies a provider that requires passenger-specific contact details. Do not fabricate or misattribute contact details; make a separate explicit product/provider decision if this case must be supported.

## 12. References

- Duffel, [Modelling customers in Duffel](https://duffel.com/docs/guides/modelling-customers-in-duffel)
- Duffel, [Orders API](https://duffel.com/docs/api/v2/orders)
- Duffel, [Getting started with flights](https://duffel.com/docs/guides/getting-started-with-flights)

Recheck provider documentation when implementing the Duffel adapter. Requirements can change and may vary by airline, route, offer, and booking context.
