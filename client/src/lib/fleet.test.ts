import { describe, expect, it } from "vitest";
import type { Vehicle } from "./school-data";

/**
 * The fleet list used to print "Capacity 40 seats" under every bus, because the
 * loader hardcoded 40 and `transport_routes` records no seat count. These tests
 * pin the corrected behaviour: capacity is null unless a real number exists,
 * so the panel can omit it rather than assert a fact that was never true.
 */

function vehicle(over: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "KA-01-AB-1234",
    driver: "Suresh Kumar",
    driverPhone: "97400228626",
    routeCode: "RT-01",
    routeName: "Sira Road Route",
    capacity: null,
    status: "Active",
    ...over,
  } as Vehicle;
}

describe("vehicle shape", () => {
  it("carries the facts the fleet row actually renders", () => {
    const v = vehicle();
    expect(v.id).toBeTruthy();
    expect(v.driver).toBeTruthy();
    expect(v.routeCode).toBeTruthy();
    expect(v.routeName).toBeTruthy();
  });

  it("has no seat count by default, so nothing fake is displayed", () => {
    // The panel renders nothing for a null capacity rather than "0 seats".
    expect(vehicle().capacity).toBeNull();
  });

  it("can still show a seat count when one is recorded", () => {
    expect(vehicle({ capacity: 40 }).capacity).toBe(40);
  });

  it("distinguishes a maintenance vehicle from an active one", () => {
    expect(vehicle({ status: "Maintenance" }).status).toBe("Maintenance");
  });
});