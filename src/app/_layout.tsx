import { useFonts } from "expo-font"
import { SplashScreen, Stack } from "expo-router"
import { useEffect } from "react"

import "./global.css"

// this prevents the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
	const [fontsLoaded, error] = useFonts({
		"Inter-Bold": require("@/assets/fonts/Inter-Bold.ttf"),
		"Inter-Light": require("@/assets/fonts/Inter-Light.ttf"),
		"Inter-Medium": require("@/assets/fonts/Inter-Medium.ttf"),
		"Inter-Regular": require("@/assets/fonts/Inter-Regular.ttf"),
		"Inter-SemiBold": require("@/assets/fonts/Inter-SemiBold.ttf"),
	})

	useEffect(() => {
		if (error) throw error
		if (fontsLoaded) SplashScreen.hideAsync()
	}, [fontsLoaded, error])

	// render nothing while assets load so the splash screen stays perfectly seamless
	if (!fontsLoaded && !error) {
		return null
	}

	return <Stack screenOptions={{ headerShown: false }} />
}
