import { landing } from "@/lib/copy";

// "See it in a store": the /store preview. No probe for a local WooCommerce on :8080: when it is down,
// Chrome logs "Failed to load resource: net::ERR_CONNECTION_REFUSED" even for a caught no-cors fetch.
export function StoreLink({ code, className }: { code: string; className?: string }) {
  return (
    <a href={`/store/${code}`} className={className} data-testid="store-link">
      {landing.hero.store}
    </a>
  );
}
