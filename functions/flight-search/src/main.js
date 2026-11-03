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
		priceAmount: typeof offer.total_amount === "string" ? offer.total_amount : null,
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


function normalizeDecimal(value) {
	if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) return null
	const [whole, fraction = ""] = value.split(".")
	const normalizedWhole = whole.replace(/^0+(?=\d)/, "")
	const normalizedFraction = fraction.replace(/0+$/, "")
	return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole
}

function validateRefreshRequest(body) {
	if (!isRecord(body)) return "Provide a valid offer-refresh request."
	if (typeof body.offerId !== "string" || !/^off_[A-Za-z0-9]+$/.test(body.offerId)) {
		return "Provide a valid Duffel offer ID."
	}
	const expected = body.expectedOffer
	if (!isRecord(expected) || expected.id !== body.offerId) {
		return "Provide the selected offer snapshot for comparison."
	}
	if (
		typeof expected.totalAmount !== "string" ||
		normalizeDecimal(expected.totalAmount) === null ||
		typeof expected.totalCurrency !== "string" ||
		!/^[A-Z]{3}$/.test(expected.totalCurrency)
	) {
		return "Provide the selected offer's displayed amount and currency."
	}
	if (!Array.isArray(expected.passengers) || expected.passengers.length === 0 || !Array.isArray(expected.slices) || expected.slices.length === 0) {
		return "The selected offer snapshot must include passengers and itinerary slices."
	}
	if (
		expected.passengers.some((passenger) => !isRecord(passenger) || typeof passenger.id !== "string" || !passenger.id) ||
		new Set(expected.passengers.map((passenger) => passenger?.id)).size !== expected.passengers.length ||
		expected.slices.some((slice) =>
			!isRecord(slice) ||
			typeof slice.originCode !== "string" ||
			typeof slice.destinationCode !== "string" ||
			!Array.isArray(slice.segments) ||
			slice.segments.length === 0 ||
			slice.segments.some((segment) =>
				!isRecord(segment) ||
				typeof segment.id !== "string" ||
				typeof segment.departureAt !== "string" ||
				typeof segment.arrivalAt !== "string",
			),
		)
	) {
		return "The selected offer snapshot contains invalid passenger or itinerary data."
	}
	return null
}

function compareOfferItinerary(expected, current) {
	const differences = []
	const expectedPassengerIds = expected.passengers.map((passenger) => passenger.id).sort()
	const currentPassengerIds = current.passengers.map((passenger) => passenger.id).sort()
	if (JSON.stringify(expectedPassengerIds) !== JSON.stringify(currentPassengerIds)) {
		differences.push("passenger_identity")
	}
	if (expected.slices.length !== current.slices.length) {
		differences.push("slice_count")
		return differences
	}
	for (let sliceIndex = 0; sliceIndex < expected.slices.length; sliceIndex += 1) {
		const before = expected.slices[sliceIndex]
		const after = current.slices[sliceIndex]
		if (before.originCode !== after.originCode || before.destinationCode !== after.destinationCode) {
			differences.push(`slice_${sliceIndex + 1}_route`)
		}
		if (before.segments.length !== after.segments.length) {
			differences.push(`slice_${sliceIndex + 1}_segment_count`)
			continue
		}
		for (let segmentIndex = 0; segmentIndex < before.segments.length; segmentIndex += 1) {
			const oldSegment = before.segments[segmentIndex]
			const newSegment = after.segments[segmentIndex]
			if (
				oldSegment.id !== newSegment.id ||
				oldSegment.departureAt !== newSegment.departureAt ||
				oldSegment.arrivalAt !== newSegment.arrivalAt
			) {
				differences.push(`slice_${sliceIndex + 1}_segment_${segmentIndex + 1}`)
			}
		}
	}
	return [...new Set(differences)]
}

async function refreshOffer(offerId, expectedOffer, token, res, log, error) {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), 25000)
	try {
		const response = await fetch(`${DUFFEL_BASE_URL}/air/offers/${encodeURIComponent(offerId)}`, {
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
			const providerCode = payload?.errors?.[0]?.code
			const unavailable = response.status === 404 || response.status === 410 ||
				(typeof providerCode === "string" && /(offer.*(unavailable|no_longer_available|not[_ -]?available|expired|not[_ -]?found)|not[_ -]?found)/i.test(providerCode))
			if (unavailable) {
				return res.json({
					status: "unavailable",
					code: "OFFER_NO_LONGER_AVAILABLE",
					message: "This flight offer is no longer available. Search again to find current options.",
				})
			}
			log(`Duffel offer refresh failed with HTTP ${response.status}.`)
			return jsonError(res, 502, "DUFFEL_OFFER_REFRESH_FAILED", "We couldn't verify this flight offer. Please try again.")
		}

		const rawOffer = payload?.data
		if (
			!isRecord(rawOffer) ||
			rawOffer.id !== offerId ||
			typeof rawOffer.total_amount !== "string" ||
			normalizeDecimal(rawOffer.total_amount) === null ||
			typeof rawOffer.total_currency !== "string" ||
			!/^[A-Z]{3}$/.test(rawOffer.total_currency) ||
			!Array.isArray(rawOffer.passengers) ||
			!Array.isArray(rawOffer.slices)
		) {
			error("Duffel returned an incomplete or mismatched offer-refresh response.")
			return jsonError(res, 502, "DUFFEL_INVALID_OFFER_RESPONSE", "The flight provider returned an unexpected offer response.")
		}

		const current = mapOffer(rawOffer)
		if (
			current.passengers.length !== rawOffer.passengers.length ||
			new Set(current.passengers.map((passenger) => passenger.id)).size !== current.passengers.length ||
			current.passengers.length === 0 ||
			current.slices.length === 0 ||
			current.slices.length !== rawOffer.slices.length ||
			current.slices.some((slice) => !slice.originCode || !slice.destinationCode || !slice.segments.length ||
				slice.segments.some((segment) => !segment.id || !segment.departureAt || !segment.arrivalAt))
		) {
			error("Duffel returned offer data without complete passenger or itinerary identities.")
			return jsonError(res, 502, "DUFFEL_INVALID_OFFER_RESPONSE", "The flight provider returned incomplete passenger or itinerary details.")
		}
		if (rawOffer.expires_at !== undefined && rawOffer.expires_at !== null &&
			(typeof rawOffer.expires_at !== "string" || !Number.isFinite(Date.parse(rawOffer.expires_at)))) {
			error("Duffel returned an offer with an invalid expiry timestamp.")
			return jsonError(res, 502, "DUFFEL_INVALID_OFFER_RESPONSE", "The flight provider returned an invalid offer expiry.")
		}
		if (rawOffer.expires_at && Date.parse(rawOffer.expires_at) <= Date.now()) {
			return res.json({
				status: "unavailable",
				code: "OFFER_EXPIRED",
				message: "This flight offer has expired. Search again to find current options.",
			})
		}

		const materialDifferences = compareOfferItinerary(expectedOffer, current)
		const priceChanged =
			normalizeDecimal(expectedOffer.totalAmount) !== normalizeDecimal(rawOffer.total_amount) ||
			expectedOffer.totalCurrency !== rawOffer.total_currency
		const offer = {
			...current,
			priceAmount: rawOffer.total_amount,
			price: Number(rawOffer.total_amount),
		}
		if (materialDifferences.length) {
			return res.json({
				status: "itinerary_changed",
				materialDifferences,
				priceChanged,
				previousPrice: { amount: expectedOffer.totalAmount, currency: expectedOffer.totalCurrency },
				currentPrice: { amount: rawOffer.total_amount, currency: rawOffer.total_currency },
				offer,
			})
		}
		if (priceChanged) {
			return res.json({
				status: "price_changed",
				previousPrice: { amount: expectedOffer.totalAmount, currency: expectedOffer.totalCurrency },
				currentPrice: { amount: rawOffer.total_amount, currency: rawOffer.total_currency },
				offer,
			})
		}
		return res.json({ status: "valid", offer })
	} catch (cause) {
		error(cause instanceof Error ? cause.message : "Unknown offer-refresh error.")
		return jsonError(
			res,
			502,
			"DUFFEL_OFFER_REFRESH_UNAVAILABLE",
			cause?.name === "AbortError"
				? "Verifying this flight offer took too long. Please try again."
				: "We couldn't reach the flight provider to verify this offer.",
		)
	} finally {
		clearTimeout(timeout)
	}
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


	if (isRecord(body) && body.action === "refresh-offer") {
		const validationError = validateRefreshRequest(body)
		if (validationError) {
			return jsonError(res, 400, "INVALID_OFFER_REFRESH_REQUEST", validationError)
		}
		const token = process.env.DUFFEL_ACCESS_TOKEN
		if (!token) {
			error("DUFFEL_ACCESS_TOKEN is not configured for the flight search function.")
			return jsonError(res, 503, "FLIGHT_SEARCH_NOT_CONFIGURED", "Flight search is not configured yet.")
		}
		return refreshOffer(body.offerId, body.expectedOffer, token, res, log, error)
	}

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

export { compareOfferItinerary, formatDuration, mapOffer, mapPassengers, mapSeatMaps, normalizeDecimal, validateRefreshRequest, validateRequest }
