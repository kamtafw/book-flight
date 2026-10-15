const DUFFEL_API_URL = "https://api.duffel.com/air/offer_requests"

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
    operatingCarrierName: operatingCarrier.name ?? operatingCarrier.iata_code ?? "Unknown operating carrier",
    operatingCarrierCode: operatingCarrier.iata_code ?? "",
    flightNumber: `${marketingCarrier.iata_code ?? ""} ${segment.marketing_carrier_flight_number ?? ""}`.trim(),
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
    slices,
  }
}

function validateRequest(body) {
  if (!isRecord(body)) return "Provide a valid flight-search request."

  const { origin, destination, departureDate, adults, cabinClass } = body
  if ((body.children !== undefined && body.children !== 0) || (body.infants !== undefined && body.infants !== 0)) {
    return "This version supports adult travellers only. Remove children and infants from the search."
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
    Number.isNaN(Date.parse(`${departureDate}T00:00:00Z`)) ||
    new Date(`${departureDate}T00:00:00Z`).toISOString().slice(0, 10) !== departureDate
  ) {
    return "Departure date must be a valid date in YYYY-MM-DD format."
  }
  if (departureDate < new Date().toISOString().slice(0, 10)) {
    return "Departure date cannot be in the past."
  }
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) {
    return "Choose between 1 and 9 adult travellers."
  }
  if (typeof cabinClass !== "string" || !CABIN_CLASSES.has(cabinClass)) {
    return "Choose a supported cabin class."
  }

  return null
}

export default async function ({ req, res, log, error }) {
  if (req.method !== "POST") {
    return jsonError(res, 405, "METHOD_NOT_ALLOWED", "Use POST to search for flights.")
  }

  const body = req.bodyJson
  const validationError = validateRequest(body)
  if (validationError) {
    return jsonError(res, 400, "INVALID_SEARCH_REQUEST", validationError)
  }

  const token = process.env.DUFFEL_ACCESS_TOKEN
  if (!token) {
    error("DUFFEL_ACCESS_TOKEN is not configured for the flight-search function.")
    return jsonError(res, 503, "FLIGHT_SEARCH_NOT_CONFIGURED", "Flight search is not configured yet.")
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
            passengers: Array.from({ length: body.adults }, () => ({ type: "adult" })),
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
      return jsonError(res, 502, "DUFFEL_INVALID_RESPONSE", "The flight provider returned an unexpected response.")
    }

    const offers = payload.data.offers
      .filter((offer) => offer && typeof offer.id === "string" && Number.isFinite(Number(offer.total_amount)))
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

export { formatDuration, mapOffer, validateRequest }
