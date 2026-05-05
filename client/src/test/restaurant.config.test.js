import { describe, it, expect } from "vitest";
import restaurantConfig from "../config/restaurant";

describe("restaurantConfig", () => {
  it("has required contact information", () => {
    expect(restaurantConfig.contact.address).toBeTruthy();
    expect(restaurantConfig.contact.phone).toBeTruthy();
    expect(restaurantConfig.contact.email).toBeTruthy();
    expect(restaurantConfig.contact.whatsappNumber).toBeTruthy();
  });

  it("has reservation zones defined", () => {
    expect(restaurantConfig.reservations.zones.length).toBeGreaterThan(0);
    restaurantConfig.reservations.zones.forEach((zone) => {
      expect(zone.label).toBeTruthy();
      expect(zone.value).toBeTruthy();
    });
  });

  it("has valid time configuration", () => {
    expect(restaurantConfig.reservations.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(restaurantConfig.reservations.endTime).toMatch(/^\d{2}:\d{2}$/);
    expect(restaurantConfig.reservations.intervalMinutes).toBeGreaterThan(0);
  });

  it("has social links", () => {
    expect(restaurantConfig.social.instagram).toMatch(/^https:\/\//);
    expect(restaurantConfig.social.facebook).toMatch(/^https:\/\//);
  });
});
