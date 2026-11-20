import {
	FlightSearchError,
	type FlightOffer,
	type OfferRefreshExpectedSnapshot,
		type OfferRefreshResponse,
	type FlightSearchRequest,
	type FlightSearchResponse,
	type SeatMapResponse,
	type SeatServiceValidationResponse,
	type SelectedSeatService,
} from "@/lib/flights/types"

function getConfig() {
	const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT?.trim()
	const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID?.trim()
	const functionId = process.env.EXPO_PUBLIC_APPWRITE_FLIGHT_SEARCH_FUNCTION_ID?.trim()

	if (!endpoint || !projectId || !functionId) {
		throw new FlightSearchError(
			"Flight search is not configured yet. The Appwrite endpoint, project ID, and flight-search function ID are required.",
			"APPWRITE_NOT_CONFIGURED",
		)
	}

	return {
		endpoint: endpoint.replace(/\/$/, ""),
		projectId,
		functionId,
	}
}

function toIsoDate(value: string): string {
	const parts = value.split("/")
	if (parts.length !== 3) {
		throw new FlightSearchError("Choose a valid departure date before searching.", "INVALID_DATE")
	}

	const [day, month, year] = parts.map(Number)
	const date = new Date(Date.UTC(year, month - 1, day))

	if (
		!day ||
		!month ||
		!year ||
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		throw new FlightSearchError("Choose a valid departure date before searching.", "INVALID_DATE")
	}

	return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-")
}

function validatePassengers(request: FlightSearchRequest) {
	if (!Number.isInteger(request.adults) || request.adults < 1 || request.adults > 9) {
		throw new FlightSearchError("Choose between 1 and 9 adult travellers.", "INVALID_PASSENGERS")
	}

	if (
		!Array.isArray(request.childAges) ||
		request.childAges.some((age) => !Number.isInteger(age) || age < 2 || age > 11)
	) {
		throw new FlightSearchError(
			"Each child must have an age from 2 through 11.",
			"INVALID_PASSENGERS",
		)
	}

	if (
		!Array.isArray(request.infantAges) ||
		request.infantAges.some((age) => !Number.isInteger(age) || age < 0 || age > 1)
	) {
		throw new FlightSearchError("Each infant must have an age of 0 or 1.", "INVALID_PASSENGERS")
	}

	if (request.infantAges.length > request.adults) {
		throw new FlightSearchError(
			"Each infant must be accompanied by an adult.",
			"INVALID_PASSENGERS",
		)
	}

	if (request.adults + request.childAges.length + request.infantAges.length > 9) {
		throw new FlightSearchError("A search can include at most 9 travellers.", "INVALID_PASSENGERS")
	}
}

export async function searchFlights(request: FlightSearchRequest): Promise<FlightSearchResponse> {
	validatePassengers(request)

	const { endpoint, projectId, functionId } = getConfig()
	const response = await fetch(
		`${endpoint}/functions/${encodeURIComponent(functionId)}/executions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Appwrite-Project": projectId,
			},
			body: JSON.stringify({
				async: false,
				method: "POST",
				path: "/",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					origin: request.origin,
					destination: request.destination,
					departureDate: toIsoDate(request.departureDate),
					adults: request.adults,
					childAges: request.childAges,
					infantAges: request.infantAges,
					cabinClass:
						request.cabinClass === "premium-economy" ? "premium_economy" : request.cabinClass,
				}),
			}),
		},
	)

	if (!response.ok) {
		throw new FlightSearchError(
			response.status === 401 || response.status === 403
				? "Appwrite rejected the flight-search request. Check the function's execution permissions."
				: "We couldn't reach flight search. Please try again.",
			"APPWRITE_EXECUTION_FAILED",
		)
	}

	const execution = (await response.json()) as {
		responseBody?: string
		responseStatusCode?: number
		status?: string
	}

	let result: FlightSearchResponse & { error?: string; code?: string }
	try {
		result = JSON.parse(execution.responseBody ?? "") as FlightSearchResponse & {
			error?: string
			code?: string
		}
	} catch {
		throw new FlightSearchError(
			"Flight search returned an unreadable response.",
			"INVALID_RESPONSE",
		)
	}

	if ((execution.responseStatusCode ?? 200) >= 400 || result.error) {
		throw new FlightSearchError(
			result.error ?? "Flight search failed. Please try again.",
			result.code ?? "FLIGHT_SEARCH_FAILED",
		)
	}

	if (!Array.isArray(result.offers)) {
		throw new FlightSearchError(
			"Flight search returned an unexpected response.",
			"INVALID_RESPONSE",
		)
	}

	return { offers: result.offers as FlightOffer[] }
}

export async function getSeatMaps(offerId: string): Promise<SeatMapResponse> {
	if (!/^off_[A-Za-z0-9]+$/.test(offerId)) {
		throw new FlightSearchError(
			"Choose a valid flight offer before requesting seat maps.",
			"INVALID_OFFER_ID",
		)
	}

	const { endpoint, projectId, functionId } = getConfig()
	const response = await fetch(
		`${endpoint}/functions/${encodeURIComponent(functionId)}/executions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Appwrite-Project": projectId,
			},
			body: JSON.stringify({
				async: false,
				method: "POST",
				path: "/",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "seat-map", offerId }),
			}),
		},
	)

	if (!response.ok) {
		throw new FlightSearchError(
			response.status === 401 || response.status === 403
				? "Appwrite rejected the seat-map request. Check the function's execution permissions."
				: "We couldn't reach seat maps. Please try again.",
			"APPWRITE_EXECUTION_FAILED",
		)
	}

	const execution = (await response.json()) as {
		responseBody?: string
		responseStatusCode?: number
		status?: string
	}

	let result: SeatMapResponse & { error?: string; code?: string }
	try {
		result = JSON.parse(execution.responseBody ?? "") as typeof result
	} catch {
		throw new FlightSearchError("Seat maps returned an unreadable response.", "INVALID_RESPONSE")
	}

	if ((execution.responseStatusCode ?? 200) >= 400 || result.error) {
		throw new FlightSearchError(
			result.error ?? "Seat-map retrieval failed. Please try again.",
			result.code ?? "SEAT_MAP_FAILED",
		)
	}

	if (!Array.isArray(result.seatMaps)) {
		throw new FlightSearchError("Seat maps returned an unexpected response.", "INVALID_RESPONSE")
	}

	return result
}

export async function validateSeatServices(
	offerId: string,
	selectedSeats: SelectedSeatService[],
): Promise<SeatServiceValidationResponse> {
	if (!/^off_[A-Za-z0-9]+$/.test(offerId)) {
		throw new FlightSearchError(
			"Choose a valid flight offer before validating seats.",
			"INVALID_OFFER_ID",
		)
	}
	if (!Array.isArray(selectedSeats)) {
		throw new FlightSearchError(
			"Seat selections must be provided as an array.",
			"INVALID_SEAT_SELECTIONS",
		)
	}
	if (selectedSeats.length === 0) {
		return { status: "not_selected", selections: [] }
	}
	if (
		selectedSeats.some(
			(seat) =>
				seat.offerId !== offerId ||
				!seat.id ||
				!seat.passengerId ||
				!seat.segmentId ||
				!seat.seatDesignator ||
				!seat.totalAmount ||
				!seat.totalCurrency,
		)
	) {
		throw new FlightSearchError(
			"One or more selected seats do not belong to this flight offer or are incomplete.",
			"INVALID_SEAT_SELECTIONS",
		)
	}

	const { endpoint, projectId, functionId } = getConfig()
	const response = await fetch(
		`${endpoint}/functions/${encodeURIComponent(functionId)}/executions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Appwrite-Project": projectId,
			},
			body: JSON.stringify({
				async: false,
				method: "POST",
				path: "/",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "validate-seat-services",
					offerId,
					selectedSeats: selectedSeats.map((seat) => ({
						serviceId: seat.id,
						passengerId: seat.passengerId,
						segmentId: seat.segmentId,
						seatDesignator: seat.seatDesignator,
						expectedAmount: seat.totalAmount,
						expectedCurrency: seat.totalCurrency,
						expectedDisclosures: seat.disclosures,
					})),
				}),
			}),
		},
	)

	if (!response.ok) {
		throw new FlightSearchError(
			response.status === 401 || response.status === 403
				? "Appwrite rejected the seat-validation request. Check the function's execution permissions."
				: "We couldn't reach seat validation. Please try again.",
			"APPWRITE_EXECUTION_FAILED",
		)
	}

	const execution = (await response.json()) as {
		responseBody?: string
		responseStatusCode?: number
		status?: string
	}
	let result: SeatServiceValidationResponse & { error?: string; code?: string }
	try {
		result = JSON.parse(execution.responseBody ?? "") as typeof result
	} catch {
		throw new FlightSearchError(
			"Seat validation returned an unreadable response.",
			"INVALID_RESPONSE",
		)
	}

	if (!result || typeof result !== "object" || Array.isArray(result)) {
		throw new FlightSearchError(
			"Seat validation returned an unexpected response.",
			"INVALID_RESPONSE",
		)
	}
	if ((execution.responseStatusCode ?? 200) >= 400 || result.error) {
		throw new FlightSearchError(
			result.error ?? "Seat validation failed. Please try again.",
			result.code ?? "SEAT_VALIDATION_FAILED",
		)
	}
	if (
		!["valid", "price_changed", "selection_changed", "not_selected"].includes(result.status) ||
		!Array.isArray(result.selections)
	) {
		throw new FlightSearchError(
			"Seat validation returned an unexpected response.",
			"INVALID_RESPONSE",
		)
	}
	return result
}


const DECIMAL_AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\\.\d+)?$/
const OFFER_ID_PATTERN = /^off_[A-Za-z0-9]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDecimalAmount(value: unknown): value is string {
	return typeof value === "string" && DECIMAL_AMOUNT_PATTERN.test(value)
}

function isRefreshPrice(value: unknown): value is { amount: string; currency: string } {
	return (
		isRecord(value) &&
		isDecimalAmount(value.amount) &&
		typeof value.currency === "string" &&
		/^[A-Z]{3}$/.test(value.currency)
	)
}

function isRefreshedOffer(value: unknown, expectedOfferId: string): value is FlightOffer {
	if (
		!isRecord(value) ||
		value.id !== expectedOfferId ||
		!isDecimalAmount(value.priceAmount) ||
		typeof value.price !== "number" ||
		!Number.isFinite(value.price) ||
		typeof value.currency !== "string" ||
		!/^[A-Z]{3}$/.test(value.currency) ||
		typeof value.expiresAt !== "string" ||
		!Number.isFinite(Date.parse(value.expiresAt)) ||
		!Array.isArray(value.passengers) ||
		value.passengers.length === 0 ||
		!Array.isArray(value.slices) ||
		value.slices.length === 0
	) {
		return false
	}

	if (
		value.passengers.some(
			(passenger) => !isRecord(passenger) || typeof passenger.id !== "string" || !passenger.id,
		)
	) {
		return false
	}

	return value.slices.every(
		(slice) =>
			isRecord(slice) &&
			typeof slice.originCode === "string" &&
			typeof slice.destinationCode === "string" &&
			Array.isArray(slice.segments) &&
			slice.segments.length > 0 &&
			slice.segments.every(
				(segment) =>
					isRecord(segment) &&
					typeof segment.id === "string" &&
					Boolean(segment.id) &&
					typeof segment.departureAt === "string" &&
					Number.isFinite(Date.parse(segment.departureAt)) &&
					typeof segment.arrivalAt === "string" &&
					Number.isFinite(Date.parse(segment.arrivalAt)),
			),
	)
}

/**
 * Build the untrusted comparison snapshot required by BR-02 from the exact
 * offer originally selected by the customer. Never derive priceAmount from
 * the rounded numeric display price.
 */
export function buildOfferRefreshSnapshot(offer: FlightOffer): OfferRefreshExpectedSnapshot {
	if (!OFFER_ID_PATTERN.test(offer.id)) {
		throw new FlightSearchError("Choose a valid flight offer before reviewing it.", "INVALID_OFFER_ID")
	}
	if (!isDecimalAmount(offer.priceAmount)) {
		throw new FlightSearchError(
			"The original flight price is unavailable or invalid. Return to search and select the flight again.",
			"INVALID_OFFER_PRICE",
		)
	}
	if (typeof offer.currency !== "string" || !/^[A-Z]{3}$/.test(offer.currency)) {
		throw new FlightSearchError("The selected flight has an invalid currency.", "INVALID_OFFER_CURRENCY")
	}
	if (!Array.isArray(offer.passengers) || offer.passengers.length === 0) {
		throw new FlightSearchError(
			"The selected flight is missing its passenger references. Return to search and select it again.",
			"INVALID_OFFER_PASSENGERS",
		)
	}
	if (!Array.isArray(offer.slices) || offer.slices.length === 0) {
		throw new FlightSearchError(
			"The selected flight is missing its itinerary. Return to search and select it again.",
			"INVALID_OFFER_ITINERARY",
		)
	}

	const passengers = offer.passengers.map((passenger) => {
		if (!passenger.id) {
			throw new FlightSearchError("The selected flight contains an invalid passenger reference.", "INVALID_OFFER_PASSENGERS")
		}
		return { id: passenger.id }
	})
	const slices = offer.slices.map((slice) => {
		if (!slice.originCode || !slice.destinationCode || !Array.isArray(slice.segments) || !slice.segments.length) {
			throw new FlightSearchError("The selected flight contains an invalid itinerary.", "INVALID_OFFER_ITINERARY")
		}
		return {
			originCode: slice.originCode,
			destinationCode: slice.destinationCode,
			segments: slice.segments.map((segment) => {
				if (
					!segment.id ||
					!segment.departureAt ||
					!Number.isFinite(Date.parse(segment.departureAt)) ||
					!segment.arrivalAt ||
					!Number.isFinite(Date.parse(segment.arrivalAt))
				) {
					throw new FlightSearchError("The selected flight contains an invalid segment.", "INVALID_OFFER_ITINERARY")
				}
				return {
					id: segment.id,
					departureAt: segment.departureAt,
					arrivalAt: segment.arrivalAt,
				}
			}),
		}
	})

	return {
		id: offer.id,
		totalAmount: offer.priceAmount,
		totalCurrency: offer.currency,
		passengers,
		slices,
	}
}

export async function refreshOffer(offer: FlightOffer): Promise<OfferRefreshResponse> {
	const expectedOffer = buildOfferRefreshSnapshot(offer)
	const { endpoint, projectId, functionId } = getConfig()
	let response: Response
	try {
		response = await fetch(
			`${endpoint}/functions/${encodeURIComponent(functionId)}/executions`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Appwrite-Project": projectId,
				},
				body: JSON.stringify({
					async: false,
					method: "POST",
					path: "/",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						action: "refresh-offer",
						offerId: offer.id,
						expectedOffer,
					}),
				}),
			},
		)
	} catch {
		throw new FlightSearchError(
			"We couldn't reach the flight provider to verify this offer. Please try again.",
			"OFFER_REFRESH_NETWORK_ERROR",
		)
	}

	if (!response.ok) {
		throw new FlightSearchError(
			response.status === 401 || response.status === 403
				? "Appwrite rejected the offer refresh request. Check the function's execution permissions."
				: "We couldn't verify this flight offer. Please try again.",
			"APPWRITE_EXECUTION_FAILED",
		)
	}

	let execution: { responseBody?: string; responseStatusCode?: number }
	try {
		execution = (await response.json()) as typeof execution
	} catch {
		throw new FlightSearchError("Offer refresh returned an unreadable execution.", "INVALID_RESPONSE")
	}

	let result: unknown
	try {
		result = JSON.parse(execution.responseBody ?? "")
	} catch {
		throw new FlightSearchError("Offer refresh returned an unreadable response.", "INVALID_RESPONSE")
	}
	if (!isRecord(result)) {
		throw new FlightSearchError("Offer refresh returned an unexpected response.", "INVALID_RESPONSE")
	}

	if ((execution.responseStatusCode ?? 200) >= 400 || result.error) {
		throw new FlightSearchError(
			typeof result.error === "string"
				? result.error
				: "We couldn't verify this flight offer. Please try again.",
			typeof result.code === "string" ? result.code : "OFFER_REFRESH_FAILED",
		)
	}

	if (result.status === "unavailable") {
		if (typeof result.code !== "string" || typeof result.message !== "string") {
			throw new FlightSearchError("Offer refresh returned an unexpected response.", "INVALID_RESPONSE")
		}
		return { status: "unavailable", code: result.code, message: result.message }
	}

	if (
		result.status === "valid" &&
		isRefreshedOffer(result.offer, offer.id)
	) {
		return { status: "valid", offer: result.offer }
	}

	if (
		result.status === "price_changed" &&
		isRefreshPrice(result.previousPrice) &&
		isRefreshPrice(result.currentPrice) &&
		isRefreshedOffer(result.offer, offer.id)
	) {
		return {
			status: "price_changed",
			previousPrice: result.previousPrice,
			currentPrice: result.currentPrice,
			offer: result.offer,
		}
	}

	if (
		result.status === "itinerary_changed" &&
		Array.isArray(result.materialDifferences) &&
		result.materialDifferences.every((item) => typeof item === "string") &&
		typeof result.priceChanged === "boolean" &&
		isRefreshPrice(result.previousPrice) &&
		isRefreshPrice(result.currentPrice) &&
		isRefreshedOffer(result.offer, offer.id)
	) {
		return {
			status: "itinerary_changed",
			materialDifferences: result.materialDifferences,
			priceChanged: result.priceChanged,
			previousPrice: result.previousPrice,
			currentPrice: result.currentPrice,
			offer: result.offer,
		}
	}

	throw new FlightSearchError("Offer refresh returned an unexpected response.", "INVALID_RESPONSE")
}
