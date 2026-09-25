import type { NextConfig } from 'next';
const config: NextConfig = { devIndicators: false, serverExternalPackages: ['@pdf-lib/fontkit', 'pdf-lib'] };
export default config;
