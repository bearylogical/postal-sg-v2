/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {
      spacing: {
        '7.5': '1.875rem', // 30px
      },
    },
  },
  plugins: [],
}

