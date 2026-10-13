import { expect, it } from "vitest";
import {
  getActivePlatform,
  getAvailablePlatforms,
} from "../../src/lib/platforms";

it("selects only enabled platforms and respects their route boundaries", () => {
  expect(getAvailablePlatforms(false).map((platform) => platform.id)).toEqual([
    "instagram",
  ]);
  expect(getAvailablePlatforms(true).map((platform) => platform.id)).toEqual([
    "instagram",
    "whatsapp",
  ]);
  expect(getActivePlatform("/whatsapp/chat-analyzer/", false).id).toBe(
    "instagram",
  );
  expect(getActivePlatform("/whatsapp", true).id).toBe("whatsapp");
  expect(getActivePlatform("/whatsapp/chat-analyzer/", true).id).toBe(
    "whatsapp",
  );
  expect(getActivePlatform("/whatsappish/", true).id).toBe("instagram");
  expect(getActivePlatform("/", true).id).toBe("instagram");
});
