/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "./components/workflow/xyflow-tokens.js": {},
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};

export default config;
