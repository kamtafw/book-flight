const DUFFEL_API_URL = "https://api.duffel.com/air/offer_requests"
const DUFFEL_BASE_URL = "https://api.duffel.com"

const CABIN_CLASSES = new Set(["economy", "premium_economy", "business", "first"])

function jsonError(res, status, code, message) {
	return res.json({ error: message, code }, status)
}

function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

function formatDuration(value) {
	if (typeof value !== "string") return null
	const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
	if (!match) return value

	const hours = Number(match[1] ?? 0)
	const minutes = Number(match[2] ?? 0)
	if (hours && minutes) return `${hours}h ${minutes}m`
	if (hours) return `${hours}h`
	return `${minutes}m`
}

function localTime(value) {
	if (typeof value !== "string") return ""
	const match = value.match(/T(\d{2}:\d{2})/)
	return match?.[1] ?? value
}

function mapSegment(segment) {
	const marketingCarrier = segment.marketing_carrier ?? {}
	const operatingCarrier = segment.operating_carrier ?? {}
	const departure = segment.origin ?? {}
	const arrival = segment.destination ?? {}

	return {
		id: segment.id,
		departureAirportCode: departure.iata_code ?? "",
		departureAirportName: departure.name ?? departure.iata_code ?? "",
		departureAt: segment.departing_at ?? "",
		arrivalAirportCode: arrival.iata_code ?? "",
		arrivalAirportName: arrival.name ?? arrival.iata_code ?? "",
		arrivalAt: segment.arriving_at ?? "",
		marketingCarrierName: marketingCarrier.name ?? marketingCarrier.iata_code ?? "Unknown airline",
		marketingCarrierCode: marketingCarrier.iata_code ?? "",
		operatingCarrierName:
			operatingCarrier.name ?? operatingCarrier.iata_code ?? "Unknown operating carrier",
		operatingCarrierCode: operatingCarrier.iata_code ?? "",
		flightNumber:
			`${marketingCarrier.iata_code ?? ""} ${segment.marketing_carrier_flight_number ?? ""}`.trim(),
		duration: formatDuration(segment.duration),
	}
}

function mapOffer(offer) {
	const slices = (offer.slices ?? []).map((slice) => {
		const segments = (slice.segments ?? []).map(mapSegment)
		return {
			originCode: slice.origin?.iata_code ?? segments[0]?.departureAirportCode ?? "",
			destinationCode:
				slice.destination?.iata_code ?? segments[segments.length - 1]?.arrivalAirportCode ?? "",
			duration: formatDuration(slice.duration),
			segments,
		}
	})

	const segments = slices.flatMap((slice) => slice.segments)
	const first = segments[0]
	const last = segments[segments.length - 1]
	const operatingCarrierNames = [
		...new Set(segments.map((segment) => segment.operatingCarrierName).filter(Boolean)),
	]

	return {
		id: offer.id,
		airline: offer.owner?.name ?? first?.marketingCarrierName ?? "Unknown airline",
		flightNumber: first?.flightNumber ?? "Flight details unavailable",
		departureTime: localTime(first?.departureAt),
		arrivalTime: localTime(last?.arrivalAt),
		duration: formatDuration(slices[0]?.duration) ?? "Duration unavailable",
		price: Number(offer.total_amount),
		currency: offer.total_currency,
		expiresAt: offer.expires_at ?? null,
		operatingCarrierNames,
		passengers: (Array.isArray(offer.passengers) ? offer.passengers : [])
			.filter((passenger) => isRecord(passenger) && typeof passenger.id === "string")
			.map((passenger) => ({
				id: passenger.id,
				type: typeof passenger.type === "string" ? passenger.type : null,
				age: Number.isInteger(passenger.age) ? passenger.age : null,
			})),
		slices,
	}
}

function mapSeatMaps(seatMaps) {
	if (!Array.isArray(seatMaps)) return []

	return seatMaps.filter(isRecord).map((seatMap) => ({
		id: typeof seatMap.id === "string" ? seatMap.id : "",
		segmentId: typeof seatMap.segment_id === "string" ? seatMap.segment_id : "",
		sliceId: typeof seatMap.slice_id === "string" ? seatMap.slice_id : "",
		cabins: (Array.isArray(seatMap.cabins) ? seatMap.cabins : []).filter(isRecord).map((cabin) => ({
			id: typeof cabin.id === "string" ? cabin.id : "",
			deck: Number.isInteger(cabin.deck) ? cabin.deck : 0,
			rows: (Array.isArray(cabin.rows) ? cabin.rows : []).filter(isRecord).map((row, rowIndex) => ({
				index: rowIndex,
				sections: (Array.isArray(row.sections) ? row.sections : [])
					.filter(isRecord)
					.map((section) => ({
						elements: (Array.isArray(section.elements) ? section.elements : [])
							.filter(isRecord)
							.map((element) => ({
								type: typeof element.type === "string" ? element.type : "unknown",
								designator: typeof element.designator === "string" ? element.designator : null,
								name: typeof element.name === "string" ? element.name : "",
								disclosures: Array.isArray(element.disclosures)
									? element.disclosures.filter((item) => typeof item === "string")
									: [],
								availableServices: (Array.isArray(element.available_services)
									? element.available_services
									: []
								)
									.filter(isRecord)
									.map((service) => ({
										id: typeof service.id === "string" ? service.id : "",
										passengerId:
											typeof service.passenger_id === "string" ? service.passenger_id : "",
										totalAmount:
											typeof service.total_amount === "string" ? service.total_amount : "",
										totalCurrency:
											typeof service.total_currency === "string" ? service.total_currency : "",
									}))
									.filter((service) => service.id && service.passengerId),
							})),
					})),
			})),
		})),
	}))
}

async function getSeatMaps(offerId, token, res, log, error) {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), 25000)

	try {
		const url = new URL(`${DUFFEL_BASE_URL}/air/seat_maps`)
		url.searchParams.set("offer_id", offerId)
		const response = await fetch(url, {
			method: "GET",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
				"Duffel-Version": "v2",
			},
		})
		const payload = await response.json().catch(() => null)

		if (!response.ok) {
			const message =
				typeof payload?.errors?.[0]?.message === "string"
					? payload.errors[0].message
					: "Duffel could not retrieve seat maps for this offer."
			log(`Duffel seat-map request failed with HTTP ${response.status}.`)
			return jsonError(res, 502, "DUFFEL_SEAT_MAP_FAILED", message)
		}

		if (!Array.isArray(payload?.data)) {
			error("Duffel returned a seat-map response without a data array.")
			return jsonError(
				res,
				502,
				"DUFFEL_INVALID_SEAT_MAP_RESPONSE",
				"The flight provider returned an unexpected seat-map response.",
			)
		}

		return res.json({ seatMaps: mapSeatMaps(payload.data) })
	} catch (cause) {
		error(cause instanceof Error ? cause.message : "Unknown seat-map error.")
		return jsonError(
			res,
			502,
			"DUFFEL_SEAT_MAP_UNAVAILABLE",
			cause?.name === "AbortError"
				? "Retrieving seat maps took too long. Please try again."
				: "We couldn't reach the flight provider for seat maps.",
		)
	} finally {
		clearTimeout(timeout)
	}
}

function validateRequest(body) {
	if (!isRecord(body)) return "Provide a valid flight-search request."

	const { origin, destination, departureDate, adults, cabinClass } = body
	const childAges = body.childAges === undefined ? [] : body.childAges
	const infantAges = body.infantAges === undefined ? [] : body.infantAges

	if (body.children !== undefined || body.infants !== undefined) {
		return "Provide childAges and infantAges arrays instead of child or infant counts."
	}
	if (
		!Array.isArray(childAges) ||
		childAges.some((age) => !Number.isInteger(age) || age < 2 || age > 11)
	) {
		return "Each child must have an age from 2 through 11."
	}
	if (
		!Array.isArray(infantAges) ||
		infantAges.some((age) => !Number.isInteger(age) || age < 0 || age > 1)
	) {
		return "Each infant must have an age of 0 or 1."
	}
	if (typeof origin !== "string" || !/^[A-Z]{3}$/.test(origin)) {
		return "Origin must be a three-letter IATA airport code."
	}
	if (typeof destination !== "string" || !/^[A-Z]{3}$/.test(destination)) {
		return "Destination must be a three-letter IATA airport code."
	}
	if (origin === destination) return "Origin and destination must be different."
	if (
		typeof departureDate !== "string" ||
		!/^\d{4}-\d{2}-\d{2}$/.test(departureDate) ||
		Number.isNaN(Date.parse(departureDate + "T00:00:00Z")) ||
		new Date(departureDate + "T00:00:00Z").toISOString().slice(0, 10) !== departureDate
	) {
		return "Departure date must be a valid date in YYYY-MM-DD format."
	}
	if (departureDate < new Date().toISOString().slice(0, 10)) {
		return "Departure date cannot be in the past."
	}
	if (!Number.isInteger(adults) || adults < 1 || adults > 9) {
		return "Choose between 1 and 9 adult travellers."
	}
	if (infantAges.length > adults) {
		return "Each infant must be accompanied by an adult."
	}
	if (adults + childAges.length + infantAges.length > 9) {
		return "A search can include at most 9 travellers."
	}
	if (typeof cabinClass !== "string" || !CABIN_CLASSES.has(cabinClass)) {
		return "Choose a supported cabin class."
	}

	return null
}

function mapPassengers(adults, childAges = [], infantAges = []) {
	return [
		...Array.from({ length: adults }, () => ({ type: "adult" })),
		...childAges.map((age) => ({ age })),
		...infantAges.map((age) => ({ age })),
	]
}

export default async function ({ req, res, log, error }) {
	if (req.method !== "POST") {
		return jsonError(res, 405, "METHOD_NOT_ALLOWED", "Use POST to search for flights.")
	}

	const body = req.bodyJson

	if (isRecord(body) && body.action === "seat-map") {
		if (typeof body.offerId !== "string" || !/^off_[A-Za-z0-9]+$/.test(body.offerId)) {
			return jsonError(res, 400, "INVALID_SEAT_MAP_REQUEST", "Provide a valid Duffel offer ID.")
		}
		const token = process.env.DUFFEL_ACCESS_TOKEN
		if (!token) {
			error("DUFFEL_ACCESS_TOKEN is not configured for the flight search function.")
			return jsonError(
				res,
				503,
				"FLIGHT_SEARCH_NOT_CONFIGURED",
				"Flight search is not configured yet.",
			)
		}
		return getSeatMaps(body.offerId, token, res, log, error)
	}

	const validationError = validateRequest(body)
	if (validationError) {
		return jsonError(res, 400, "INVALID_SEARCH_REQUEST", validationError)
	}

	const token = process.env.DUFFEL_ACCESS_TOKEN
	if (!token) {
		error("DUFFEL_ACCESS_TOKEN is not configured for the flight-search function.")
		return jsonError(
			res,
			503,
			"FLIGHT_SEARCH_NOT_CONFIGURED",
			"Flight search is not configured yet.",
		)
	}

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), 55000)

	try {
		const duffelResponse = await fetch(
			`${DUFFEL_API_URL}?return_offers=true&supplier_timeout=45000`,
			{
				method: "POST",
				signal: controller.signal,
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					Accept: "application/json",
					"Duffel-Version": "v2",
				},
				body: JSON.stringify({
					data: {
						slices: [
							{
								origin: body.origin,
								destination: body.destination,
								departure_date: body.departureDate,
							},
						],
						passengers: mapPassengers(body.adults, body.childAges ?? [], body.infantAges ?? []),
						cabin_class: body.cabinClass,
					},
				}),
			},
		)

		const payload = await duffelResponse.json().catch(() => null)
		if (!duffelResponse.ok) {
			const duffelMessage =
				typeof payload?.errors?.[0]?.message === "string"
					? payload.errors[0].message
					: "Duffel could not complete this search."
			log(`Duffel search failed with HTTP ${duffelResponse.status}.`)
			return jsonError(res, 502, "DUFFEL_SEARCH_FAILED", duffelMessage)
		}

		if (!Array.isArray(payload?.data?.offers)) {
			error("Duffel returned a response without an offers array.")
			return jsonError(
				res,
				502,
				"DUFFEL_INVALID_RESPONSE",
				"The flight provider returned an unexpected response.",
			)
		}

		const offers = payload.data.offers
			.filter(
				(offer) =>
					offer && typeof offer.id === "string" && Number.isFinite(Number(offer.total_amount)),
			)
			.map(mapOffer)
			.filter((offer) => offer.slices.length > 0 && offer.slices[0].segments.length > 0)

		return res.json({ offers })
	} catch (cause) {
		error(cause instanceof Error ? cause.message : "Unknown flight-search error.")
		return jsonError(
			res,
			502,
			"FLIGHT_SEARCH_UNAVAILABLE",
			cause?.name === "AbortError"
				? "The flight search took too long. Please try again."
				: "We couldn't reach the flight provider. Please try again.",
		)
	} finally {
		clearTimeout(timeout)
	}
}

export { formatDuration, mapOffer, mapPassengers, mapSeatMaps, validateRequest }
