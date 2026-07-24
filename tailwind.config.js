/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif']
			},
			colors: {
				mint: {
					50: '#eefcf5',
					100: '#d6f7e6',
					200: '#b0eece',
					300: '#7ce0af',
					400: '#45cb8e',
					500: '#1eb373',
					600: '#12925b',
					700: '#11744b',
					800: '#125c3d',
					900: '#114c34',
					950: '#082b1e'
				},
				teal: {
					50: '#eefcf5',
					100: '#d6f7e6',
					200: '#b0eece',
					300: '#7ce0af',
					400: '#45cb8e',
					500: '#1eb373',
					600: '#12925b',
					700: '#11744b',
					800: '#125c3d',
					900: '#114c34',
					950: '#082b1e'
				}
			},
			borderRadius: {
				'control': '8px',
				'input': '10px',
				'button': '10px',
				'card-sm': '14px',
				'card': '18px',
				'section': '22px'
			}
		}
	},
	plugins: []
};
