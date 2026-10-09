export interface ApiSite {
  id: number | string;
  name: string;
  locationName?: string | null;
  siteType?: string;
  allowRegistration?: boolean;
  address?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    addressLine3?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: { name?: string } | null;
  } | null;
  latLong?: { latitude?: number | null; longitude?: number | null } | null;
}

export interface Site {
  id: string;
  name: string;
  city: string;
  onlyForStudents: boolean;
  allowRegistration: boolean;
  address: string[];
  coordinates: [number, number] | null;
}

export interface City {
  name: string;
  sites: Site[];
}

const restriction = /\s*\(only for\s+.*?\s+students\)\s*/gi;
const alphabetically = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

export function normalizeSites(input: ApiSite[]): Site[] {
  return input
    .filter((site) => site.siteType !== "ADMINISTRATIVE")
    .map((site) => {
      const name = site.name.replace(restriction, " ").trim();
      const address = site.address;
      const lat = site.latLong?.latitude;
      const lng = site.latLong?.longitude;
      const valid =
        typeof lat === "number" &&
        typeof lng === "number" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180;
      return {
        id: String(site.id),
        name,
        city: site.locationName?.trim() || "Other locations",
        onlyForStudents: name !== site.name.trim(),
        allowRegistration: site.allowRegistration === true,
        address: [
          address?.addressLine1,
          address?.addressLine2,
          address?.addressLine3,
          [address?.city, address?.state, address?.zip]
            .filter(Boolean)
            .join(", "),
          address?.country?.name,
        ]
          .filter(
            (line): line is string =>
              typeof line === "string" && Boolean(line.trim()),
          )
          .map((line) => line.trim()),
        coordinates: valid ? [lat, lng] : null,
      };
    });
}

export function groupSites(sites: Site[], query = ""): City[] {
  const grouped = new Map<string, Site[]>();
  const search = query.trim().toLocaleLowerCase();
  for (const site of sites) {
    if (
      search &&
      !`${site.name} ${site.city} ${site.address.join(" ")}`
        .toLocaleLowerCase()
        .includes(search)
    )
      continue;
    const city = grouped.get(site.city) ?? [];
    city.push(site);
    grouped.set(site.city, city);
  }
  return [...grouped]
    .sort(([a], [b]) => alphabetically.compare(a, b))
    .map(([name, sites]) => ({
      name,
      sites: sites.sort(
        (a, b) =>
          Number(a.onlyForStudents) - Number(b.onlyForStudents) ||
          alphabetically.compare(a.name, b.name),
      ),
    }));
}
