/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    FISH_API_KEY: process.env.FISH_API_KEY,
    FISH_MODEL_ID: process.env.FISH_MODEL_ID,
  },
}

module.exports = nextConfig