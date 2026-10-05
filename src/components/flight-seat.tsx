import { clsx } from "clsx"
import { Pressable, Text, View } from "react-native"

interface FlightSeatProps {
	label: string
	status: "available" | "reserved" | "emergency" | "selected"
	onPress: () => void
}

export function FlightSeat({ label, status, onPress }: FlightSeatProps) {
	const disabled = status === "reserved" || status === "emergency"

	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			hitSlop={2}
			className="h-12 w-14 items-center justify-center"
		>
			<View
				className={clsx(
					"h-10 w-12 items-center justify-center rounded-lg",
					status === "available" && "bg-gray-400",
					status === "selected" && "bg-primary",
					status === "reserved" && "bg-gray-300",
					status === "emergency" && "bg-gray-200",
				)}
			>
				<Text
					className={clsx(
						"font-inter-medium text-sm",
						status === "available" && "text-black",
						status === "selected" && "text-white",
						status === "reserved" && "text-gray-100",
						status === "emergency" && "text-white",
					)}
				>
					{label}
				</Text>
			</View>
		</Pressable>
	)
}
