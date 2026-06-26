/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // ESP32 main.cpp 는 "/esp" 를 폴링하므로 /api/esp 로 매핑
    return [{ source: "/esp", destination: "/api/esp" }];
  },
};

export default nextConfig;
