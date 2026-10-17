export type PlatformId = "instagram" | "whatsapp" | "facebook";
export type PlatformMarkId = "orbit" | "chat" | "friends";

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
    productName: "InstaScope",
    basePath: "/whatsapp/",
    description: "Explore your chat patterns",
    mark: "chat",
    chrome: {
      kind: "standard",
      navigation: [
        { href: "/whatsapp/", label: "Overview" },
        { href: "/whatsapp/chat-analyzer/", label: "Chat Analyzer" },
        { href: "/whatsapp/wrapped/", label: "Wrapped" },
        { href: "/whatsapp/chat-vault/", label: "Chat Vault" },
      ],
      footer: {
        tagline: "A little clarity for your conversations.",
        disclaimer: "Independent tool. Not affiliated with WhatsApp or Meta.",
      },
    },
  },
  {
    id: "facebook",
    name: "Facebook",
    productName: "InstaScope",
    basePath: "/facebook/",
    description: "Explore your recorded connections",
    mark: "friends",
    chrome: {
      kind: "standard",
      navigation: [{ href: "/facebook/", label: "Friends Explorer" }],
      footer: {
        tagline: "Your connections, in your own time.",
        disclaimer: "Independent tool. Not affiliated with Facebook or Meta.",
      },
    },
  },
];

export function getAvailablePlatforms(
  whatsappEnabled: boolean,
  facebookEnabled = false,
) {
  const enabledPlatforms: Record<PlatformId, boolean> = {
    instagram: true,
    whatsapp: whatsappEnabled,
    facebook: facebookEnabled,
  };
  return PLATFORM_REGISTRY.filter((platform) => enabledPlatforms[platform.id]);
}

export function getActivePlatform(
  pathname: string,
  whatsappEnabled: boolean,
  facebookEnabled = false,
): PlatformDefinition {
  return (
    getAvailablePlatforms(whatsappEnabled, facebookEnabled).find(
      (platform) =>
        platform.basePath !== "/" &&
        (pathname === platform.basePath.slice(0, -1) ||
          pathname.startsWith(platform.basePath)),
    ) ?? PLATFORM_REGISTRY[0]
  );
}
