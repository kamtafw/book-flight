import assert from "node:assert/strict"
import test from "node:test"
import {
	completeSeatReviewValidation,
	createSeatReviewSnapshotKey,
	failSeatReviewValidation,
	isSeatReviewAttemptCurrent,
	isSeatReviewLifecycleForSession,
	startSeatReviewValidation,
} from "./seat-review-lifecycle"

const identity = {
	reviewSessionId: "review-1",
	bookingSessionId: "booking-1",
	offerId: "off_123",
}

function seat(overrides = {}) {
	return {
		id: "service-1",
		offerId: "off_123",
		passengerId: "pas_1",
		segmentId: "seg_1",
		seatDesignator: "12A",
		totalAmount: "25.00",
		totalCurrency: "USD",
		disclosures: [],
		...overrides,
	}
}

function started(
	selections = [seat()],
	current = null,
	retry = false,
	expiry = "2026-12-01T10:00:00Z",
) {
	const result = startSeatReviewValidation(
		current,
		identity,
		selections,
		expiry,
		Date.parse("2026-12-01T08:00:00Z"),
		retry,
	)
	assert.equal(result.kind, "started")
	if (result.kind !== "started") throw new Error("Expected a started attempt")
	return result
}

test("records not_selected without creating a provider attempt", () => {
	const result = startSeatReviewValidation(null, identity, [], "2026-12-01T10:00:00Z")
	assert.equal(result.kind, "not_selected")
	assert.equal(result.lifecycle.status, "not_selected")
	assert.deepEqual(result.lifecycle.outcome, { status: "not_selected", selections: [] })
})

test("seat snapshots are order-independent but include every material selection field", () => {
	const a = seat()
	const b = seat({ id: "service-2", passengerId: "pas_2", seatDesignator: "12B" })
	assert.equal(createSeatReviewSnapshotKey([a, b]), createSeatReviewSnapshotKey([b, a]))
	assert.notEqual(
		createSeatReviewSnapshotKey([a]),
		createSeatReviewSnapshotKey([seat({ totalAmount: "30.00" })]),
	)
	assert.notEqual(
		createSeatReviewSnapshotKey([a]),
		createSeatReviewSnapshotKey([seat({ disclosures: ["Exit row"] })]),
	)
	assert.notEqual(
		createSeatReviewSnapshotKey([a]),
		createSeatReviewSnapshotKey([seat({ passengerId: "pas_2" })]),
	)
})

test("starts validation for a new review, booking, offer or seat snapshot", () => {
	const first = started()
	assert.equal(first.attempt.attemptNumber, 1)
	assert.equal(isSeatReviewLifecycleForSession(first.lifecycle, identity), true)
	assert.equal(
		isSeatReviewLifecycleForSession(first.lifecycle, {
			...identity,
			bookingSessionId: "booking-2",
		}),
		false,
	)
	const changed = started([seat({ seatDesignator: "14C" })], first.lifecycle)
	assert.equal(changed.attempt.attemptNumber, 1)
	assert.notEqual(changed.attempt.snapshotKey, first.attempt.snapshotKey)
})

test("blocks duplicate in-flight requests and reuses an unexpired completed result", () => {
	const first = started()
	assert.equal(
		startSeatReviewValidation(first.lifecycle, identity, [seat()], "2026-12-01T10:00:00Z").kind,
		"blocked",
	)
	const completed = completeSeatReviewValidation(
		first.lifecycle,
		first.attempt,
		first.attempt.snapshotKey,
		{
			status: "valid",
			selections: [
				{
					status: "valid",
					selection: seat(),
					current: {
						serviceId: "service-1",
						passengerId: "pas_1",
						segmentId: "seg_1",
						seatDesignator: "12A",
						seatName: "Window",
						disclosures: [],
						amount: "25.00",
						currency: "USD",
					},
				},
			],
		},
	)
	assert.equal(completed?.status, "valid")
	assert.equal(
		startSeatReviewValidation(
			completed,
			identity,
			[seat()],
			"2026-12-01T10:00:00Z",
			Date.parse("2026-12-01T09:00:00Z"),
		).kind,
		"reuse",
	)
})

test("does not reuse a completed validation after the offer expires", () => {
	const first = started()
	const completed = completeSeatReviewValidation(
		first.lifecycle,
		first.attempt,
		first.attempt.snapshotKey,
		{
			status: "valid",
			selections: [
				{
					status: "valid",
					selection: seat(),
					current: {
						serviceId: "service-1",
						passengerId: "pas_1",
						segmentId: "seg_1",
						seatDesignator: "12A",
						seatName: "Window",
						disclosures: [],
						amount: "25.00",
						currency: "USD",
					},
				},
			],
		},
	)
	const next = startSeatReviewValidation(
		completed,
		identity,
		[seat()],
		"2026-12-01T10:00:00Z",
		Date.parse("2026-12-01T10:00:00Z"),
	)
	assert.equal(next.kind, "started")
})

test("requires explicit retry and exhausts after three technical failures", () => {
	const first = started()
	const failed1 = failSeatReviewValidation(
		first.lifecycle,
		first.attempt,
		first.attempt.snapshotKey,
		"Network error",
	)
	assert.equal(failed1?.status, "error")
	assert.equal(
		startSeatReviewValidation(failed1, identity, [seat()], "2026-12-01T10:00:00Z").kind,
		"blocked",
	)
	const second = started([seat()], failed1, true)
	assert.equal(second.attempt.attemptNumber, 2)
	const failed2 = failSeatReviewValidation(
		second.lifecycle,
		second.attempt,
		second.attempt.snapshotKey,
		"Network error",
	)
	const third = started([seat()], failed2, true)
	assert.equal(third.attempt.attemptNumber, 3)
	const exhausted = failSeatReviewValidation(
		third.lifecycle,
		third.attempt,
		third.attempt.snapshotKey,
		"Network error",
	)
	assert.equal(exhausted?.status, "retry_exhausted")
	assert.equal(
		startSeatReviewValidation(
			exhausted,
			identity,
			[seat()],
			"2026-12-01T10:00:00Z",
			Date.now(),
			true,
		).kind,
		"blocked",
	)
})

test("ignores stale responses after a seat change or a newer attempt", () => {
	const first = started()
	assert.equal(
		isSeatReviewAttemptCurrent(
			first.lifecycle,
			first.attempt,
			createSeatReviewSnapshotKey([seat({ seatDesignator: "14C" })]),
		),
		false,
	)
	const changed = started([seat({ seatDesignator: "14C" })], first.lifecycle)
	assert.equal(
		completeSeatReviewValidation(changed.lifecycle, first.attempt, first.attempt.snapshotKey, {
			status: "not_selected",
			selections: [],
		}),
		null,
	)
	assert.equal(
		isSeatReviewAttemptCurrent(changed.lifecycle, first.attempt, changed.attempt.snapshotKey),
		false,
	)
})

test("does not accept a stale result after review or booking session changes", () => {
	const first = started()
	const changedIdentity = { ...identity, reviewSessionId: "review-2" }
	const result = startSeatReviewValidation(
		first.lifecycle,
		changedIdentity,
		[seat()],
		"2026-12-01T10:00:00Z",
	)
	assert.equal(result.kind, "started")
	assert.equal(
		completeSeatReviewValidation(result.lifecycle, first.attempt, first.attempt.snapshotKey, {
			status: "not_selected",
			selections: [],
		}),
		null,
	)
})
