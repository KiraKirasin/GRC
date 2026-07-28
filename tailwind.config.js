/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FBF5FF',
          100: '#F5EDFF',
          200: '#E7E6F4',
          300: '#D6D5EC',
          400: '#873DDC',
          500: '#5E57B7',
          600: '#690DD3',
          700: '#5E1CAB',
          800: '#4A0B94',
          900: '#3A077A',
        },
        neutral: {
          0: '#FFFFFF',
          5: '#FDFDFE',
          10: '#FBFCFC',
          15: '#F5F7F8',
          20: '#F5F6F8',
          30: '#EEF0F2',
          40: '#E6E8EC',
          50: '#E2E4E9',
          100: '#DBDFE4',
          130: '#C4CBD4',
          200: '#929DAF',
          300: '#5f6b7a',
          310: '#4C5866',
          320: '#464B53',
          330: '#414C58',
          340: '#32383C',
          350: '#202427',
          360: '#191B1C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
