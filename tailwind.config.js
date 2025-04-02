// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Custom color palette for your game
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Add more custom colors as needed
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
        // Add record-collector inspired fonts
        records: ['Permanent Marker', 'Bebas Neue', 'cursive'],
        vintage: ['Playfair Display', 'serif'],
        vinyl: ['Rubik Mono One', 'Impact', 'monospace'],
      },
      screens: {
        xs: '375px', // Minimum width you're targeting
        sm: '640px', // Small tablets
        md: '768px', // Medium tablets
        lg: '1024px', // Laptops
        xl: '1280px', // Desktops
        '2xl': '1536px', // Large desktops
      },
    },
  },
  plugins: [],
};
