import type { OfferReviewOutcome } from "./offer-review"

export type OfferReviewLifecycleStatus =
	| "refreshing"
	| "ready"
	| "price_changed"
	| "itinerary_changed"
	| "unavailable"
	| "error"
	| "retry_exhausted"

export interface OfferReviewLifecycleIdentity {
	reviewSessionId: string
	bookingSessionId: string
	offerId: string
}

export interface OfferReviewAttempt extends OfferReviewLifecycleIdentity {
	attemptId: string
	attemptNumber: number
}

export interface OfferReviewLifecycle extends OfferReviewAttempt {
	status: OfferReviewLifecycleStatus
	outcome: OfferReviewOutcome | null
	errorMessage: string | null
}

export function isOfferReviewLifecycleForSession(
	lifecycle: OfferReviewLifecycle | null,
	identity: OfferReviewLifecycleIdentity,
): lifecycle is OfferReviewLifecycle {
	return Boolean(
		lifecycle &&
		lifecycle.reviewSessionId === identity.reviewSessionId &&
		lifecycle.bookingSessionId === identity.bookingSessionId &&
		lifecycle.offerId === identity.offerId,
	)
}

export function isOfferReviewAttemptCurrent(
	lifecycle: OfferReviewLifecycle | null,
	attempt: OfferReviewAttempt,
): boolean {
	return Boolean(
		isOfferReviewLifecycleForSession(lifecycle, attempt) &&
		lifecycle.attemptId === attempt.attemptId &&
		lifecycle.attemptNumber === attempt.attemptNumber &&
		lifecycle.status === "refreshing",
	)
}

export function getOfferReviewOutcomeStatus(
	outcome: OfferReviewOutcome,
): Exclude<OfferReviewLifecycleStatus, "refreshing" | "error" | "retry_exhausted"> {
	switch (outcome.status) {
		case "valid":
			return "ready"
		case "price_changed":
			return "price_changed"
		case "itinerary_changed":
			return "itinerary_changed"
		case "unavailable":
			return "unavailable"
	}
}

function getOutcomeExpiry(outcome: OfferReviewOutcome): string | null {
	switch (outcome.status) {
		case "valid":
		case "price_changed":
			return outcome.currentOffer.expiresAt
		case "itinerary_changed":
			return outcome.refreshedOffer.expiresAt
		case "unavailable":
			return null
	}
}

/**
 * A successful refresh may be reused only for the exact review/booking/offer
 * identity and only while the provider offer remains unexpired.
 */
export function shouldStartOfferReviewRefresh(
	lifecycle: OfferReviewLifecycle | null,
	identity: OfferReviewLifecycleIdentity,
	now = Date.now(),
): boolean {
	if (!isOfferReviewLifecycleForSession(lifecycle, identity)) return true

	switch (lifecycle.status) {
		case "refreshing":
		case "error":
		case "retry_exhausted":
		case "itinerary_changed":
		case "unavailable":
			return false
		case "ready":
		case "price_changed": {
			if (!lifecycle.outcome) return true
			const expiry = getOutcomeExpiry(lifecycle.outcome)
			const expiryTime = expiry ? Date.parse(expiry) : Number.NaN
			return !Number.isFinite(expiryTime) || expiryTime <= now
		}
	}
}
