import type { SelectedSeatService } from "@/lib/flights/types"
import type { SeatReviewOutcome } from "./seat-review"

export interface SeatReviewLifecycleIdentity {
	reviewSessionId: string
	bookingSessionId: string
	offerId: string
}

export interface SeatReviewAttempt extends SeatReviewLifecycleIdentity {
	attemptId: string
	attemptNumber: number
	snapshotKey: string
}

export type SeatReviewLifecycleStatus =
	| "not_selected"
	| "validating"
	| "valid"
	| "action_required"
	| "error"
	| "retry_exhausted"

export interface SeatReviewLifecycle extends SeatReviewAttempt {
	status: SeatReviewLifecycleStatus
	outcome: SeatReviewOutcome | null
	errorMessage: string | null
	offerExpiresAt: string | null
}

export type SeatReviewStartResult =
	| { kind: "not_selected"; lifecycle: SeatReviewLifecycle }
	| { kind: "reuse"; lifecycle: SeatReviewLifecycle }
	| { kind: "started"; lifecycle: SeatReviewLifecycle; attempt: SeatReviewAttempt }
	| { kind: "blocked"; lifecycle: SeatReviewLifecycle }

function selectionSnapshot(selections: SelectedSeatService[]): string {
	return JSON.stringify(
		selections
			.map((seat) => ({
				id: seat.id,
				offerId: seat.offerId,
				passengerId: seat.passengerId,
				segmentId: seat.segmentId,
				seatDesignator: seat.seatDesignator,
				totalAmount: seat.totalAmount,
				totalCurrency: seat.totalCurrency,
				disclosures: [...seat.disclosures],
			}))
			.sort((a, b) =>
				[a.offerId, a.passengerId, a.segmentId, a.seatDesignator, a.id].join("|").localeCompare(
					[b.offerId, b.passengerId, b.segmentId, b.seatDesignator, b.id].join("|"),
				),
			),
	)
}

export function createSeatReviewSnapshotKey(selections: SelectedSeatService[]): string {
	return selectionSnapshot(selections)
}

export function isSeatReviewLifecycleForSession(
	lifecycle: SeatReviewLifecycle | null,
	identity: SeatReviewLifecycleIdentity,
): lifecycle is SeatReviewLifecycle {
	return Boolean(
		lifecycle &&
			lifecycle.reviewSessionId === identity.reviewSessionId &&
			lifecycle.bookingSessionId === identity.bookingSessionId &&
			lifecycle.offerId === identity.offerId,
	)
}

export function isSeatReviewAttemptCurrent(
	lifecycle: SeatReviewLifecycle | null,
	attempt: SeatReviewAttempt,
	currentSnapshotKey: string,
): boolean {
	return Boolean(
		isSeatReviewLifecycleForSession(lifecycle, attempt) &&
			lifecycle.attemptId === attempt.attemptId &&
			lifecycle.attemptNumber === attempt.attemptNumber &&
			lifecycle.snapshotKey === attempt.snapshotKey &&
			attempt.snapshotKey === currentSnapshotKey &&
			lifecycle.status === "validating",
	)
}

function hasUnexpiredOffer(expiry: string | null, now: number): boolean {
	const timestamp = expiry ? Date.parse(expiry) : Number.NaN
	return Number.isFinite(timestamp) && timestamp > now
}

export function startSeatReviewValidation(
	current: SeatReviewLifecycle | null,
	identity: SeatReviewLifecycleIdentity,
	selections: SelectedSeatService[],
	offerExpiresAt: string | null,
	now = Date.now(),
	retry = false,
): SeatReviewStartResult {
	const snapshotKey = selectionSnapshot(selections)
	const matching = isSeatReviewLifecycleForSession(current, identity) &&
		current.snapshotKey === snapshotKey

	if (selections.length === 0) {
		const lifecycle: SeatReviewLifecycle = {
			...identity,
			attemptId: `seat-review-none-${identity.reviewSessionId}`,
			attemptNumber: 0,
			snapshotKey,
			status: "not_selected",
			outcome: { status: "not_selected", selections: [] },
			errorMessage: null,
			offerExpiresAt,
		}
		return { kind: "not_selected", lifecycle }
	}

	if (matching && current.status === "validating") return { kind: "blocked", lifecycle: current }
	if (matching && current.status === "error" && !retry) return { kind: "blocked", lifecycle: current }
	if (
		matching &&
		(current.status === "valid" || current.status === "action_required") &&
		hasUnexpiredOffer(current.offerExpiresAt, now)
	) {
		return { kind: "reuse", lifecycle: current }
	}
	if (matching && current.status === "retry_exhausted") return { kind: "blocked", lifecycle: current }

	const attemptNumber = matching && current.status === "error" ? current.attemptNumber + 1 : 1
	if (attemptNumber > 3) {
		const lifecycle: SeatReviewLifecycle = {
			...identity,
			attemptId: current?.attemptId ?? "seat-review-exhausted",
			attemptNumber: 3,
			snapshotKey,
			status: "retry_exhausted",
			outcome: null,
			errorMessage: current?.errorMessage ?? "Seat validation failed after three attempts.",
			offerExpiresAt,
		}
		return { kind: "blocked", lifecycle }
	}

	const attempt: SeatReviewAttempt = {
		...identity,
		attemptId: `seat-review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
		attemptNumber,
		snapshotKey,
	}
	const lifecycle: SeatReviewLifecycle = {
		...attempt,
		status: "validating",
		outcome: null,
		errorMessage: null,
		offerExpiresAt,
	}
	return { kind: "started", lifecycle, attempt }
}

export function completeSeatReviewValidation(
	lifecycle: SeatReviewLifecycle | null,
	attempt: SeatReviewAttempt,
	currentSnapshotKey: string,
	outcome: SeatReviewOutcome,
): SeatReviewLifecycle | null {
	if (!isSeatReviewAttemptCurrent(lifecycle, attempt, currentSnapshotKey)) return null
	return {
		...attempt,
		status: outcome.status === "action_required" ? "action_required" : "valid",
		outcome,
		errorMessage: null,
		offerExpiresAt: lifecycle.offerExpiresAt,
	}
}

export function failSeatReviewValidation(
	lifecycle: SeatReviewLifecycle | null,
	attempt: SeatReviewAttempt,
	currentSnapshotKey: string,
	message: string,
): SeatReviewLifecycle | null {
	if (!isSeatReviewAttemptCurrent(lifecycle, attempt, currentSnapshotKey)) return null
	return {
		...attempt,
		status: attempt.attemptNumber >= 3 ? "retry_exhausted" : "error",
		outcome: null,
		errorMessage: message,
		offerExpiresAt: lifecycle.offerExpiresAt,
	}
}
