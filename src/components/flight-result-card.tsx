import { Feather, FontAwesome5 } from "@expo/vector-icons"
import { Pressable, Text, View } from "react-native"

import type { FlightOffer } from "@/lib/flights/types"

interface FlightResultCardProps {
  flight: FlightOffer
  departureAirport: string
  arrivalAirport: string
  cabinLabel: string
  onCheck: () => void
}

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

export default function FlightResultCard({
  flight,
  departureAirport,
  arrivalAirport,
  cabinLabel,
  onCheck,
}: FlightResultCardProps) {
  return (
    <View className="overflow-hidden rounded-2xl bg-white shadow-md elevation-5">
      <View className="px-5 pt-5">
        <View className="flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-lg border border-border">
            <Text className="font-inter-semibold text-xs text-primary">
              {flight.airline.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-inter-semibold text-base text-black">{flight.airline}</Text>
            <Text className="mt-0.5 font-inter text-xs text-gray-200">{flight.flightNumber}</Text>
          </View>
          <Text className="font-inter text-sm text-gray-200">{flight.duration}</Text>
        </View>

        {flight.slices[0]?.segments.map((segment) => (
          <Text key={segment.id} className="mt-2 font-inter-medium text-xs text-black">
            {segment.flightNumber}: operated by {segment.operatingCarrierName}
          </Text>
        ))}
      </View>

      <View className="flex-row items-center px-5 py-5">
        <View className="flex-1">
          <Text className="font-inter-semibold text-xl text-black">{flight.departureTime}</Text>
          <Text className="mt-1 font-inter text-xs text-gray-200">{departureAirport}</Text>
        </View>

        <View className="flex-1 flex-row items-center px-2">
          <View className="h-2 w-2 rounded-full bg-gray-300" />
          <View className="h-px flex-1 bg-gray-300" />
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary shadow-md shadow-primary/30 elevation-5">
            <FontAwesome5 name="plane" size={14} color="white" />
          </View>
          <View className="h-px flex-1 bg-gray-300" />
          <View className="h-2 w-2 rounded-full bg-gray-300" />
        </View>

        <View className="flex-1 items-end">
          <Text className="font-inter-semibold text-xl text-black">{flight.arrivalTime}</Text>
          <Text className="mt-1 font-inter text-xs text-gray-200">{arrivalAirport}</Text>
        </View>
      </View>

      <View className="h-px bg-border" />

      <View className="flex-row items-center justify-between px-5 py-4">
        <View className="flex-row items-baseline gap-2">
          <Feather name="briefcase" size={17} color="#555" />
          <Text className="font-inter text-xs text-gray-200">{cabinLabel}</Text>
        </View>
        <View className="items-end">
          <Text className="font-inter text-xs text-gray-100">Total fare</Text>
          <Text className="font-inter-semibold text-xl text-black">
            {formatPrice(flight.price, flight.currency)}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onCheck}
        className="mx-5 mb-5 items-center rounded-xl bg-primary py-3.5 active:opacity-90"
      >
        <Text className="font-inter-medium text-base text-white">Check</Text>
      </Pressable>
    </View>
  )
}
