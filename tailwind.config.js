/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'u-navy': '#002D54',
                'u-navy-d': '#001A31',
                'u-gold': '#FDBD10',
            }
        },
    },
    plugins: [],
}
