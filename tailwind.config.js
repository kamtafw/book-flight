/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
	presets: [require("nativewind/preset")],
	theme: {
		extend: {
			colors: {
				primary: "#EC441E",
				background: "#FFF7F5",
				border: "#E6E8E7",
				white: {
					DEFAULT: "#FFFFFF",
					100: "#F6F6F6",
				},
				black: {
					DEFAULT: "#191919",
				},
				gray: {
					100: "#999",
					200: "#555",
					300: "#D9D9D9",
					400: "#E3E4E5",
				},
				dark: {
					100: "#181C2E",
				},
				error: "#F14141",
				success: "#34A853",
			},
			fontFamily: {
				inter: ["Inter-Regular", "sans-serif"],
				"inter-light": ["Inter-Light", "sans-serif"],
				"inter-medium": ["Inter-Medium", "sans-serif"],
				"inter-semibold": ["Inter-SemiBold", "sans-serif"], // Fixed capital S
				"inter-bold": ["Inter-Bold", "sans-serif"],
			},
		},
	},
	plugins: [],
}
