import assert from "node:assert/strict";
import { test } from "node:test";
import { type ApiSite, groupSites, normalizeSites } from "./sites.ts";

const fixture = (
  id: number,
  name: string,
  extra: Partial<ApiSite> = {},
): ApiSite => ({
  id,
  name,
  locationName: "Example city",
  allowRegistration: true,
  latLong: { latitude: 48, longitude: 67 },
  ...extra,
});

test("removes student restriction labels, preserving other parentheses", () => {
  const [site] = normalizeSites([
    fixture(1, "Example (Campus A) (only for Example students)"),
  ]);
  assert.equal(site.name, "Example (Campus A)");
  assert.equal(site.onlyForStudents, true);
  assert.equal(
    normalizeSites([fixture(2, "Open University")])[0].onlyForStudents,
    false,
  );
});

test("hides administrative sites but retains closed contest sites", () => {
  const sites = normalizeSites([
    fixture(1, "Staff", { siteType: "ADMINISTRATIVE" }),
    fixture(2, "Closed", { allowRegistration: false }),
  ]);
  assert.equal(sites.length, 1);
  assert.equal(sites[0].allowRegistration, false);
});

test("sorts cities and unrestricted/restricted subgroups alphabetically", () => {
  const cities = groupSites(
    normalizeSites([
      fixture(1, "A restricted (only for A students)"),
      fixture(2, "Z open"),
      fixture(3, "A open"),
      fixture(4, "Z restricted (only for Z students)"),
      fixture(5, "Another site", { locationName: "A city" }),
    ]),
  );
  assert.deepEqual(
    cities.map((city) => city.name),
    ["A city", "Example city"],
  );
  assert.deepEqual(
    cities[1].sites.map((site) => site.id),
    ["3", "2", "1", "4"],
  );
});

test("preserves all address details and handles missing coordinates", () => {
  const [site] = normalizeSites([
    fixture(1, "Example", {
      address: {
        addressLine1: "12 Main St",
        addressLine2: "Block B",
        addressLine3: "Room 4",
        city: "City",
        state: "Region",
        zip: "123",
        country: { name: "Country" },
      },
      latLong: { latitude: null, longitude: null },
    }),
  ]);
  assert.deepEqual(site.address, [
    "12 Main St",
    "Block B",
    "Room 4",
    "City, Region, 123",
    "Country",
  ]);
  assert.equal(site.coordinates, null);
  assert.equal(
    normalizeSites([
      fixture(2, "Invalid", { latLong: { latitude: 100, longitude: 0 } }),
    ])[0].coordinates,
    null,
  );
});

test("searches city, university, and address without changing source order", () => {
  const sites = normalizeSites([
    fixture(1, "Beta"),
    fixture(2, "Alpha", { address: { addressLine1: "12 Main Street" } }),
  ]);
  assert.equal(groupSites(sites, " MAIN ")[0].sites[0].name, "Alpha");
  assert.equal(groupSites(sites, "example city")[0].sites.length, 2);
  assert.deepEqual(groupSites(sites, "nowhere"), []);
  assert.deepEqual(
    sites.map((site) => site.name),
    ["Beta", "Alpha"],
  );
});
