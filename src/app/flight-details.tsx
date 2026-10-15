import { airports } from "@/lib/data"
import { useFlightOffersStore } from "@/store/flight-offers.store"
import { useFlightSearchStore } from "@/store/flight-search.store"
import { Feather, FontAwesome5 } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

export default function FlightDetails() {
  const { flightId } = useLocalSearchParams<{ flightId?: string }>()
  const { departureDate, fromAirport, toAirport } = useFlightSearchStore()
  const offers = useFlightOffersStore((state) => state.offers)
  const flight = offers.find((item) => item.id === flightId)

  const segments = flight?.slices[0]?.segments ?? []
  const firstSegment = segments[0]
  const lastSegment = segments[segments.length - 1]
  const departureAirport = airports.find((airport) => airport.code === firstSegment?.departureAirportCode)
    ?? airports.find((airport) => airport.code === fromAirport)
  const arrivalAirport = airports.find((airport) => airport.code === lastSegment?.arrivalAirportCode)
    ?? airports.find((airport) => airport.code === toAirport)

  const handleCancel = () => router.back()

  const handleConfirm = () => {
    if (!flight) return
    router.push({ pathname: "/choose-seat", params: { flightId: flight.id } })
  }

  if (!flight || !firstSegment || !lastSegment) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center font-inter-semibold text-lg text-black">Flight unavailable</Text>
          <Text className="mt-2 text-center font-inter text-sm text-gray-200">
            This offer is no longer in the current search results. Search again to select an available flight.
          </Text>
          <Pressable onPress={handleCancel} className="mt-5 rounded-xl bg-primary px-6 py-3">
            <Text className="font-inter-medium text-white">Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-6 py-4">
        <Pressable onPress={handleCancel} className="h-10 w-10 items-center justify-center" hitSlop={8}>
          <Feather name="chevron-left" size={28} color="#191919" />
        </Pressable>
        <Text className="mr-6 flex-1 text-center font-inter-medium text-xl text-black">
          Flight Details
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-6 pt-8 pb-8"
      >
        <View className="overflow-hidden rounded-2xl bg-white shadow">
          <View className="items-center justify-center px-5 py-7">
            <Text className="text-center font-inter-bold text-2xl text-primary">{flight.airline}</Text>
            <Text className="mt-2 font-inter text-sm text-gray-200">{flight.flightNumber}</Text>
            {flight.operatingCarrierNames.length > 0 && (
              <Text className="mt-3 text-center font-inter-medium text-sm text-black">
                Operated by {flight.operatingCarrierNames.join(", ")}
              </Text>
            )}
          </View>

          <View className="h-px bg-border" />

          <View className="px-5 py-7">
            <View className="flex-row items-start">
              <View className="flex-1">
                <Text className="font-inter-semibold text-3xl text-black">{flight.departureTime}</Text>
                <Text className="mt-1 font-inter-medium text-lg text-black">
                  {firstSegment.departureAirportCode}
                </Text>
                <Text className="mt-5 font-inter text-sm leading-5 text-gray-200" numberOfLines={3}>
                  {firstSegment.departureAirportName || departureAirport?.name}
                </Text>
              </View>

              <View className="flex-[1.15] px-2 pt-5">
                <View className="flex-row items-center">
                  <View className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  <View className="h-px flex-1 bg-gray-300" />
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
                    <FontAwesome5 name="plane" size={20} color="white" />
                  </View>
                  <View className="h-px flex-1 bg-gray-300" />
                  <View className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                </View>
              </View>

              <View className="flex-1 items-end">
                <Text className="font-inter-semibold text-3xl text-black">{flight.arrivalTime}</Text>
                <Text className="mt-1 font-inter-medium text-lg text-black">
                  {lastSegment.arrivalAirportCode}
                </Text>
                <Text className="mt-5 text-right font-inter text-sm leading-5 text-gray-200" numberOfLines={3}>
                  {lastSegment.arrivalAirportName || arrivalAirport?.name}
                </Text>
              </View>
            </View>
          </View>

          <View className="h-px bg-border" />

          <View className="flex-row gap-4 px-5 py-7">
            <View className="flex-1">
              <Text className="mb-2 ml-3 font-inter text-sm text-gray-200">Departure date</Text>
              <View className="flex-row items-center gap-3 rounded-xl border border-border px-4 py-4">
                <Feather name="calendar" size={20} color="#555" />
                <Text className="font-inter-medium text-base text-black">{departureDate}</Text>
              </View>
            </View>
            <View className="flex-1">
              <Text className="mb-2 ml-3 font-inter text-sm text-gray-200">Duration</Text>
              <View className="flex-row items-center gap-3 rounded-xl border border-border px-4 py-4">
                <Feather name="clock" size={20} color="#555" />
                <Text className="font-inter-medium text-base text-black">{flight.duration}</Text>
              </View>
            </View>
          </View>

          {segments.length > 1 && (
            <View className="border-t border-border px-5 py-4">
              <Text className="mb-3 font-inter-semibold text-base text-black">
                Flight segments ({segments.length})
              </Text>
              {segments.map((segment) => (
                <View key={segment.id} className="mb-3 rounded-xl bg-background p-3">
                  <Text className="font-inter-medium text-sm text-black">
                    {segment.departureAirportCode} → {segment.arrivalAirportCode}
                  </Text>
                  <Text className="mt-1 font-inter text-xs text-gray-200">
                    {segment.marketingCarrierName} {segment.flightNumber}
                  </Text>
                  <Text className="mt-1 font-inter text-xs text-gray-200">
                    Operated by {segment.operatingCarrierName}
                  </Text>
                  <Text className="mt-1 font-inter text-xs text-gray-200">
                    {segment.departureAt.replace("T", " ").slice(0, 16)} – {segment.arrivalAt.replace("T", " ").slice(0, 16)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View className="h-px bg-border" />

          <View className="items-center justify-center px-5 py-7">
            <Text className="font-inter-light text-2xl text-black">Total fare</Text>
            <Text className="mt-2 font-inter-bold text-4xl text-black">
              {formatPrice(flight.price, flight.currency)}
            </Text>
            {flight.expiresAt && (
              <Text className="mt-2 text-center font-inter text-xs text-gray-200">
                Offer expires {flight.expiresAt.replace("T", " ").slice(0, 16)}
              </Text>
            )}
          </View>
        </View>

        <View className="mt-10 flex-row gap-4">
          <Pressable
            onPress={handleCancel}
            className="flex-1 items-center justify-center rounded-xl border border-primary py-4 active:opacity-90"
          >
            <Text className="font-inter-medium text-lg text-primary">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            className="flex-1 items-center justify-center rounded-xl bg-primary py-4 active:opacity-90"
          >
            <Text className="font-inter-medium text-lg text-white">Confirm</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
