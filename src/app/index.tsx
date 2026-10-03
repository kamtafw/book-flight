import { Text, View } from "react-native"

export default function Index() {
	return (
		<View className="flex-1 items-center justify-center bg-white">
			<Text className="font-inter-bold text-3xl text-primary">Flight Booker</Text>
			<Text className="font-inter-light text-xl text-gray-200">Select your departure date</Text>
		</View>
	)
}
