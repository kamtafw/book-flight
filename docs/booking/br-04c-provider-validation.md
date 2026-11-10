# BR-04C: Duffel-Aware Passenger Validation Contract

**Status:** Approved for implementation  
**Branch:** `feat/booking-br-04c-provider-validation`  
**Depends on:** BR-04A passenger domain model, BR-04B multi-passenger UI, BR-02 offer refresh/validation  
**Scope:** Pure, offer-aware validation of the active passenger collection against Duffel requirements  
**Explicitly excludes:** Order creation, payment, booking confirmation, saved traveller profiles, persistence, seat-selection changes, and passenger-form redesign

## 1. Purpose

BR-04C adds a validation boundary between the provider-agnostic passenger domain model and the Duffel-specific requirements of the selected offer.

The validator must answer:
- Does every passenger in this selected offer have exactly one matching internal passenger record?
- Are the passenger's values structurally and locally valid?
- Does the selected offer require identity documents, and are the supplied documents acceptable?
- Are passenger contacts represented honestly and sufficient for the currently known Duffel requirements?
- Are infant/responsible-adult relationships valid under Duffel's rules?
- Is there enough known requirement information to say the collection is provider-ready?

This is validation only. It must not make network requests, mutate Zustand, change the form, or create an order.

## 2. Approved policy decisions

### D1. Contact belonging to another adult

- A passenger's own email address is required for Duffel provider readiness.
- Another adult's email must never satisfy that requirement, even when explicitly associated.
- A phone number belonging to another adult may be supplied as the passenger's contact number only when the contact record explicitly identifies that adult as its owner/related person.
- The validator must preserve the distinction. It must not rewrite `belongsTo: "other"` as `belongsTo: "passenger"`.
- An unassociated `belongsTo: "other"` contact is invalid for readiness.
- The adult contact owner must exist in the active passenger collection and must not be the passenger themselves.
- Do not silently copy contact values or fabricate ownership.

### D2. Children/infants without their own email

- A child or infant without an email address that genuinely belongs to that passenger cannot become Duffel provider-ready under the currently established integration contract.
- Do not duplicate a parent's/guardian's email, invent an address, or misrepresent ownership.
- Keep the passenger in draft/incomplete status and return an actionable issue.
- Revisit only if a verified provider-supported alternative is established and separately approved.

## 3. Architecture and file boundaries

Keep the provider-agnostic domain model unchanged unless implementation reveals a genuine domain-model defect.

Add a Duffel-specific adapter/validator layer:

```text
src/lib/booking/passengers/
├── passenger-domain.ts
├── passenger-domain.test.mjs
└── providers/
    └── duffel/
        ├── passenger-requirements.ts
        ├── passenger-validation.ts
        └── passenger-validation.test.mjs
```

Responsibilities:

- `passenger-requirements.ts`: derive a typed requirements object from the normalized selected offer. Preserve true, false, and unknown/missing distinctly.
- `passenger-validation.ts`: pure validation of a passenger collection against those requirements and selected-offer passenger identities.
- `passenger-validation.test.mjs`: deterministic tests with representative offers and passenger collections.

The validator must not import React Native UI modules, call Appwrite/Duffel, read global Zustand state, mutate input, or log passenger data.

## 4. Offer requirement metadata

The server-side `mapOffer()` must preserve these Duffel offer properties in the normalized `FlightOffer`:
- `passenger_identity_documents_required`
- `supported_passenger_identity_document_types`

The TypeScript offer type must represent unknown/missing metadata separately from explicit `false` or an empty supported-type list. Do not default missing metadata to `false`.

The same properties must survive offer refresh mapping. Do not use stale search-only metadata when a refreshed offer is available.

Interpretation:
- `passenger_identity_documents_required === true`: a passport is required for every passenger.
- `false`: no offer-level mandatory identity document is declared by this property; other known requirements may still apply.
- `unknown`: do not claim provider readiness because the document requirement is not known.
- When a supported document-type list is supplied, a supplied document type must be in that list.
- If the provider marks documents mandatory but omits the supported-type list, preserve the uncertainty and report that the offer's document-type requirements are incomplete rather than guessing.

No universal passport six-month validity rule is to be invented. Validate that dates are real and consistently formatted, and apply only requirements established by the selected offer/provider contract.

## 5. Provider passenger identity reconciliation

Before validating fields, establish an exact one-to-one mapping between the selected offer and the internal passenger collection.

Reject readiness when any of these occur:
- A selected-offer passenger has no internal passenger record.
- An internal passenger has no selected-offer provider reference.
- A provider reference uses a provider other than Duffel.
- A provider reference is scoped to a different offer ID.
- Provider passenger IDs are missing, duplicated, or mismatched.
- Internal passenger IDs are duplicated or relationship references are dangling.
- More than one internal passenger maps to the same provider passenger identity.

Do not use array positions, display labels, passenger order, or age sorting to repair a mismatch. Use exact provider IDs and offer-scoped references.

The active internal collection must represent exactly the selected offer's passenger set. Extra or missing records are validation failures, not silently ignored records.

## 6. Passenger identity validation

For every passenger, validate:
- Given name is present and non-empty after trimming.
- Family name is present and non-empty after trimming.
- Date of birth is a real calendar date in the agreed `YYYY-MM-DD` format.
- Gender is present and maps to a value accepted by the current Duffel API contract.
- Optional middle name/title may remain blank unless the current provider contract establishes a requirement.

Do not accept arbitrary free-text gender values as provider-ready. Normalize through an explicit Duffel adapter mapping based on the current API contract; unknown/unmappable values must produce a structured issue rather than being silently coerced.

Validate DOB against the selected offer's passenger age when that age is available:
- Calculate age on the relevant last-flight date from the selected itinerary.
- Compare with provider-returned age using a documented age calculation.
- Report inconsistency; do not overwrite provider passenger type/category or infer a new category from generic age cutoffs.
- If provider age is available, a reliable last-flight date is required to compare DOB-derived age with provider age.
- If provider age is unavailable for a passenger classified as an adult, do not block readiness on age consistency: adult search passengers are intentionally sent without ages, and the selected offer's `adult` classification remains authoritative. Still require a real, non-future DOB.
- If provider age is unavailable for a child or infant (or another age-dependent provider category), report the age check as unknown and block provider readiness. Do not infer or reconstruct the missing provider age from generic category cutoffs.
- Provider passenger type/category from the selected offer remains authoritative for adapter-level eligibility decisions.

## 7. Contact validation

For each passenger:
- A non-empty, syntactically valid email explicitly belonging to the passenger is required for Duffel provider readiness.
- A related adult's email does not satisfy the passenger's own-email requirement.
- A phone number must be present and pass conservative structural validation/normalization suitable for the current provider contract.
- A phone number belonging to another adult is accepted only when its ownership is explicitly represented and the related adult exists in the active collection.
- Do not require phone ownership to be the passenger's own when it is explicitly associated with another adult, per approved D1.
- Invalid or ambiguous contact ownership blocks provider readiness.
- Do not silently copy booking-level contact into passenger contacts.

Avoid overly strict country-specific phone assumptions. Do not reject a valid international number merely because it does not match a single national format. If a value cannot be normalized confidently, return a clear issue.

## 8. Travel-document validation

- If the selected offer explicitly requires identity documents, every passenger must have a passport.
- If documents are not required, an absent document is acceptable.
- If the requirement metadata is unknown, provider readiness is blocked until the requirement is known.
- When supported document types are provided, supplied document types must match the provider's supported values through explicit normalization.
- Validate required document number, issuing country code, and expiration date.
- Validate country codes as ISO 3166-1 alpha-2 where the provider contract expects them.
- Expired documents are invalid.
- Do not invent a six-month validity threshold or route-specific immigration rules.
- Nationality and document issuing country are different values. Do not substitute one for the other.
- Never include document values in issue messages, logs, analytics, or diagnostics.

If the current model's one-document UI cannot represent a provider requirement that genuinely needs multiple documents, report the limitation. Do not silently discard data or redesign the form within this milestone.

## 9. Infant/responsible-adult validation

Use internal passenger IDs in the domain model. The Duffel adapter resolves both parties to exact provider passenger IDs for the same selected offer.

Validate:
- Every passenger classified as an infant by the selected offer has exactly one responsible-adult relationship.
- The responsible adult exists in the same active passenger collection.
- The responsible adult is not the infant.
- The responsible passenger qualifies as an adult under the selected offer/provider passenger classification.
- No adult is assigned responsibility for more than one infant under the currently established Duffel rule.
- No dangling, duplicate, or ambiguous relationship is accepted.
- The relationship must map to the same offer as both passenger references.

Do not derive provider category from UI labels or generic age thresholds. Do not store Duffel's `infant_passenger_id` field in the provider-agnostic domain model. The adapter maps the infant's exact provider passenger ID onto the responsible adult's Duffel order representation when that later becomes relevant.

## 10. Validation result contract

Return structured issues and a distinct status. A suitable semantic shape is:

```ts
type PassengerValidationStatus =
  | "draft"
  | "locally_valid"
  | "provider_ready"

interface PassengerValidationIssue {
  code: string
  passengerId?: string
  field?: string
  severity: "error" | "warning"
  message: string
}

interface PassengerValidationResult {
  status: PassengerValidationStatus
  issues: PassengerValidationIssue[]
}
```

Exact names may be refined, but preserve these semantics:

- `draft`: required information is missing, locally invalid, or internal mapping/relationships are inconsistent.
- `locally_valid`: generic structure and local value checks pass, but one or more known Duffel requirements fail or required provider metadata is unknown.
- `provider_ready`: all known selected-offer Duffel requirements pass and no required metadata is unknown.

Warnings may communicate non-blocking information. Errors block the next status. Unknown required provider metadata must never be converted into a passing result.

The result is a pre-order validation result only. It is not provider acceptance, a reservation, an order, payment readiness, or booking confirmation.

Issue messages must be actionable and must not echo passport numbers, email addresses, phone numbers, dates of birth, or other sensitive values.

## 11. Acceptance criteria

- [ ] Offer mapping preserves document-required metadata and supported document types.
- [ ] Explicit false and missing/unknown metadata remain distinct through initial and refreshed offer mapping.
- [ ] Selected-offer/internal-passenger mapping is exact, one-to-one, provider-correct, and offer-scoped.
- [ ] Missing, duplicate, mismatched, extra, and foreign-offer identities block readiness.
- [ ] Required names, real DOB, and supported gender values are validated.
- [ ] DOB/age consistency uses the selected itinerary's last-flight date and provider-returned age when available; missing adult age does not block readiness, while missing age for child/infant categories does.
- [ ] Provider passenger category is not redefined by generic age cutoffs.
- [ ] Passenger's own email is required; another adult's email cannot satisfy it.
- [ ] A phone owned by another adult is accepted only with explicit, valid ownership association.
- [ ] Children/infants without their own email remain not provider-ready.
- [ ] Required passport data is enforced only when the selected offer requires it.
- [ ] Supplied document types are checked against the selected offer's supported types.
- [ ] Document expiry and country-code formats are validated without invented immigration rules.
- [ ] Infant responsibility is validated using internal IDs and Duffel's unique-adult rule.
- [ ] Structured issues identify the affected passenger/field without exposing sensitive values.
- [ ] Draft, locally-valid, and provider-ready remain distinct.
- [ ] Validation is pure and deterministic; it performs no network calls and no store/UI mutation.
- [ ] Existing search, offer refresh, and seat passenger-ID associations remain intact.
- [ ] No order creation, payment, booking confirmation, persistence, or form redesign is introduced.

## 12. Test matrix

At minimum, tests must cover:

**Offer metadata**
- document requirement true, false, and missing/unknown;
- supported types present, empty, and missing;
- metadata preserved by initial offer mapping and refresh mapping.

**Passenger identity**
- exact one-to-one mapping;
- missing internal passenger;
- extra internal passenger;
- missing/duplicate provider reference;
- wrong provider;
- foreign offer ID;
- duplicate internal ID;
- reordered passenger arrays still map by IDs.

**Identity fields**
- missing/blank names;
- malformed and impossible DOBs;
- valid gender mapping;
- unsupported gender value;
- DOB/age match and mismatch using last-flight date;
- missing adult age does not block readiness when DOB is locally valid;
- missing child/infant age blocks provider readiness;
- missing age-dependent category/date does not produce a false pass.

**Contacts**
- passenger-owned valid email;
- missing/invalid email;
- adult-owned email rejected as passenger email;
- child/infant without own email blocked;
- passenger-owned phone;
- explicitly associated adult-owned phone accepted;
- unassociated/invalid related owner rejected;
- malformed phone rejected.

**Documents**
- optional blank document accepted;
- mandatory passport missing;
- mandatory passport present and valid;
- unsupported type;
- missing document number/issuing country/expiry;
- invalid country code/date;
- expired passport;
- no six-month rule imposed;
- nationality never substituted for issuing country;
- unknown requirement metadata blocks provider readiness.

**Relationships and result states**
- valid infant/adult relationship;
- missing, duplicate, dangling, or self relationship;
- non-adult responsible passenger;
- one adult assigned to two infants;
- multiple infants with distinct responsible adults;
- draft/local-valid/provider-ready transitions;
- issue payloads never contain sensitive field values.

## 13. Implementation boundaries and sequence

1. Extend normalized offer types and server mapping for document requirement metadata.
2. Add pure Duffel requirements extraction.
3. Add pure provider-aware passenger validation.
4. Add focused unit tests for the full matrix above.
5. Review whether the current UI can display the returned issues without redesign. If not, document the limitation and stop; do not expand into UI redesign without approval.

No order payload transformation or order-creation endpoint is part of BR-04C. Do not implement a write path.

## 14. References

- Duffel, [Getting started with flights](https://duffel.com/docs/guides/getting-started-with-flights)
- Duffel, [Offers API](https://duffel.com/docs/api/v2/offers)
- Duffel, [Orders API](https://duffel.com/docs/api/v2/orders)
- Duffel, [Modelling customers in Duffel](https://duffel.com/docs/guides/modelling-customers-in-duffel)

Recheck the current provider documentation during implementation. Airline and offer requirements can vary and provider APIs can change.
