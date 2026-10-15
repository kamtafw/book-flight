import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FlightResultCard from "@/components/flight-result-card"
import { cabinOptions } from "@/constants"
import { searchFlights } from "@/lib/flights/api"
import { FlightSearchError, type FlightOffer } from "@/lib/flights/types"
import { airports } from "@/lib/data"
import { useFlightOffersStore } from "@/store/flight-offers.store"
import { useFlightSearchStore } from "@/store/flight-search.store"

export default function FlightResultsScreen() {
  const { tripType, departureDate, returnDate, fromAirport, toAirport, passengers, cabinClass } =
    useFlightSearchStore()
  const offers = useFlightOffersStore((state) => state.offers)
  const setOffers = useFlightOffersStore((state) => state.setOffers)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedFromAirport = airports.find((airport) => airport.code === fromAirport)
  const selectedToAirport = airports.find((airport) => airport.code === toAirport)
  const cabinLabel = cabinOptions.find((cabin) => cabin.value === cabinClass)?.label ?? "Economy"

  const travellerSummary = [
    `${passengers.adults} Adult${passengers.adults !== 1 ? "s" : ""}`,
    passengers.children > 0
      ? `${passengers.children} Child${passengers.children !== 1 ? "ren" : ""}`
      : null,
    passengers.infants > 0
      ? `${passengers.infants} Infant${passengers.infants !== 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(", ")

  useEffect(() => {
    let active = true

    async function loadOffers() {
      setLoading(true)
      setErrorMessage(null)
      setOffers([])

      if (tripType !== "one-way") {
        setErrorMessage("Live search currently supports one-way trips only.")
        setLoading(false)
        return
      }

      if (passengers.children > 0 || passengers.infants > 0) {
        setErrorMessage(
          "Live search currently supports adults only. Remove children and infants to continue.",
        )
        setLoading(false)
        return
      }

      if (!fromAirport || !toAirport || !departureDate) {
        setErrorMessage("Go back and choose your departure airport, destination, and date.")
        setLoading(false)
        return
      }

      try {
        const result = await searchFlights({
          origin: fromAirport,
          destination: toAirport,
          departureDate,
          adults: passengers.adults,
          cabinClass,
        })
        if (active) setOffers(result.offers)
      } catch (cause) {
        if (!active) return
        setErrorMessage(
          cause instanceof FlightSearchError
            ? cause.message
            : "Something went wrong while searching. Please try again.",
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadOffers()
    return () => {
      active = false
    }
  }, [
    tripType,
    departureDate,
    fromAirport,
    toAirport,
    passengers.adults,
    passengers.children,
    passengers.infants,
    cabinClass,
    setOffers,
  ])

  const handleCheck = (flightId: string) => {
    router.push({ pathname: "/flight-details", params: { flightId } })
  }

  const getAirportLabel = (offer: FlightOffer, endpoint: "departure" | "arrival") => {
    const segments = offer.slices[0]?.segments ?? []
    const segment = endpoint === "departure" ? segments[0] : segments[segments.length - 1]
    if (!segment) return endpoint === "departure" ? fromAirport ?? "" : toAirport ?? ""
    const code = endpoint === "departure" ? segment.departureAirportCode : segment.arrivalAirportCode
    const knownAirport = airports.find((airport) => airport.code === code)
    return knownAirport ? `${knownAirport.code} (${knownAirport.city})` : code
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-6 py-4">
        <Pressable onPress={() => router.back()} className="-ml-1 p-1">
          <Ionicons name="chevron-back" size={24} color="#191919" />
        </Pressable>
        <Text className="mr-6 flex-1 text-center font-inter-bold text-xl text-black">
          Search Result
        </Text>
      </View>

      <View className="px-6 pb-5">
        <View className="items-center rounded-xl border border-border bg-white px-4 py-3">
          <View className="flex-row items-center">
            <Text className="font-inter-semibold text-sm text-black">{selectedFromAirport?.code}</Text>
            <Text className="mx-2 font-inter text-gray-200">→</Text>
            <Text className="font-inter-semibold text-sm text-black">{selectedToAirport?.code}</Text>
          </View>
          <Text className="mt-1 font-inter text-xs text-gray-200">
            {departureDate}
            {tripType === "round" && returnDate ? ` · ${returnDate}` : ""}
            {" · "}
            {travellerSummary}
            {" · "}
            {cabinLabel}
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center px-8">
          <ActivityIndicator size="large" color="#EC441E" />
          <Text className="mt-4 text-center font-inter-medium text-base text-black">
            Searching available flights…
          </Text>
          <Text className="mt-2 text-center font-inter text-sm text-gray-200">
            Airlines can take a little while to respond.
          </Text>
        </View>
      ) : errorMessage ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center font-inter-semibold text-lg text-black">
            Unable to search flights
          </Text>
          <Text className="mt-3 text-center font-inter text-sm leading-5 text-gray-200">
            {errorMessage}
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-5 rounded-xl bg-primary px-6 py-3"
          >
            <Text className="font-inter-medium text-white">Edit search</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(flight) => flight.id}
          contentContainerClassName="gap-4 px-6 pb-10"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center px-6 pt-12">
              <Text className="text-center font-inter-semibold text-lg text-black">
                No flights found
              </Text>
              <Text className="mt-2 text-center font-inter text-sm text-gray-200">
                Try another date or airport pair.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <FlightResultCard
              flight={item}
              cabinLabel={cabinLabel}
              departureAirport={getAirportLabel(item, "departure")}
              arrivalAirport={getAirportLabel(item, "arrival")}
              onCheck={() => handleCheck(item.id)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
