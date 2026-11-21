/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "./styles/xyflow-tokens.cjs": {},
    autoprefixer: {},
  },
};

export default config;
