import {
  FlightSearchError,
  type FlightOffer,
  type FlightSearchRequest,
  type FlightSearchResponse,
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

  if (!Array.isArray(request.childAges) || request.childAges.some(
    (age) => !Number.isInteger(age) || age < 2 || age > 11,
  )) {
    throw new FlightSearchError("Each child must have an age from 2 through 11.", "INVALID_PASSENGERS")
  }

  if (!Array.isArray(request.infantAges) || request.infantAges.some(
    (age) => !Number.isInteger(age) || age < 0 || age > 1,
  )) {
    throw new FlightSearchError("Each infant must have an age of 0 or 1.", "INVALID_PASSENGERS")
  }

  if (request.infantAges.length > request.adults) {
    throw new FlightSearchError("Each infant must be accompanied by an adult.", "INVALID_PASSENGERS")
  }

  if (request.adults + request.childAges.length + request.infantAges.length > 9) {
    throw new FlightSearchError("A search can include at most 9 travellers.", "INVALID_PASSENGERS")
  }
}

export async function searchFlights(
  request: FlightSearchRequest,
): Promise<FlightSearchResponse> {
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
          cabinClass: request.cabinClass === "premium-economy" ? "premium_economy" : request.cabinClass,
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
    throw new FlightSearchError("Flight search returned an unreadable response.", "INVALID_RESPONSE")
  }

  if ((execution.responseStatusCode ?? 200) >= 400 || result.error) {
    throw new FlightSearchError(
      result.error ?? "Flight search failed. Please try again.",
      result.code ?? "FLIGHT_SEARCH_FAILED",
    )
  }

  if (!Array.isArray(result.offers)) {
    throw new FlightSearchError("Flight search returned an unexpected response.", "INVALID_RESPONSE")
  }

  return { offers: result.offers as FlightOffer[] }
}
