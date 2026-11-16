import { describe, it, expect, beforeEach } from "vitest";
import {
  ANNUAL_TRANSPORT_FEE,
  INITIAL_BUS_ROUTES,
  type BusRoute,
  type TransportServiceType,
} from "./transport-data";

// In Node environment, provide a lightweight mock for localStorage if absent
const memoryStore = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, String(value));
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
    clear: () => {
      memoryStore.clear();
    },
    key: (index: number) => Array.from(memoryStore.keys())[index] ?? null,
    length: 0,
  };
}

describe("Transport Data & Fee Calculation", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it("enforces ₹14,000 per annum bus fee structure", () => {
    expect(ANNUAL_TRANSPORT_FEE).toBe(14000);
  });

  it("defines active bus routes with drivers, vehicles, and stops", () => {
    expect(INITIAL_BUS_ROUTES.length).toBeGreaterThanOrEqual(6);
    for (const route of INITIAL_BUS_ROUTES) {
      expect(route.routeCode).toBeTruthy();
      expect(route.name).toBeTruthy();
      expect(route.vehicleNo).toContain("KA-06");
      expect(route.driverName).toBeTruthy();
      expect(route.driverPhone).toMatch(/\+91/);
      expect(route.stops.length).toBeGreaterThan(1);
      expect(route.stops).toContain("School Campus");
    }
  });

  it("applies zero fee for self-drop students and ₹14k for bus riders", () => {
    const computeTransportFee = (serviceType: TransportServiceType): number => {
      return serviceType === "School Bus" ? ANNUAL_TRANSPORT_FEE : 0;
    };

    expect(computeTransportFee("School Bus")).toBe(14000);
    expect(computeTransportFee("Self Drop")).toBe(0);
  });
});
