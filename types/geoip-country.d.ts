declare module "geoip-country" {
  const geoip: { lookup(ip: string): { country: string; name: string } | null };
  export default geoip;
}
