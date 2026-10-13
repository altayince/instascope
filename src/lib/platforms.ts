export type PlatformId = "instagram" | "whatsapp";
export type PlatformMarkId = "orbit" | "chat";

type PlatformChrome =
  | { kind: "instagram" }
  | {
      kind: "standard";
      navigation: readonly { href: string; label: string }[];
      footer: { tagline: string; disclaimer: string };
    };

export type PlatformDefinition = {
  id: PlatformId;
  name: string;
  productName: string;
  basePath: string;
  description: string;
  mark: PlatformMarkId;
  chrome: PlatformChrome;
};

/** Register identity and shell copy; parsing and datasets stay in their adapters. */
export const PLATFORM_REGISTRY: readonly PlatformDefinition[] = [
  {
    id: "instagram",
    name: "Instagram",
    productName: "InstaScope",
    basePath: "/",
    description: "Understand your connections",
    mark: "orbit",
    chrome: { kind: "instagram" },
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    productName: "WhatsAppScope",
    basePath: "/whatsapp/",
    description: "Explore your chat patterns",
    mark: "chat",
    chrome: {
      kind: "standard",
      navigation: [
        { href: "/whatsapp/", label: "Overview" },
        { href: "/whatsapp/chat-analyzer/", label: "Chat Analyzer" },
        { href: "/whatsapp/wrapped/", label: "Wrapped" },
      ],
      footer: {
        tagline: "A little clarity for your conversations.",
        disclaimer: "Independent tool. Not affiliated with WhatsApp or Meta.",
      },
    },
  },
];

export function getAvailablePlatforms(whatsappEnabled: boolean) {
  const enabledPlatforms: Record<PlatformId, boolean> = {
    instagram: true,
    whatsapp: whatsappEnabled,
  };
  return PLATFORM_REGISTRY.filter((platform) => enabledPlatforms[platform.id]);
}

export function getActivePlatform(
  pathname: string,
  whatsappEnabled: boolean,
): PlatformDefinition {
  return (
    getAvailablePlatforms(whatsappEnabled).find(
      (platform) =>
        platform.basePath !== "/" &&
        (pathname === platform.basePath.slice(0, -1) ||
          pathname.startsWith(platform.basePath)),
    ) ?? PLATFORM_REGISTRY[0]
  );
}
