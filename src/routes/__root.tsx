import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import appCss from "../styles.css?url";
import {
  CARD_VERSION,
  OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  TWITTER_HANDLE,
} from "@/lib/seo";

/** FOUC-safe theme boot — runs before paint */
const themeBoot = `(function(){try{var k='ses-jp-theme';var m=localStorage.getItem(k)||'dark';var r=m;if(m==='system'){r=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}else if(m!=='light'){r='dark';}var e=document.documentElement;e.classList.toggle('light',r==='light');e.classList.toggle('dark',r==='dark');e.style.colorScheme=r;e.dataset.theme=r;}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "theme-color", content: "#0b0c0e" },
      { name: "color-scheme", content: "dark light" },
      { name: "author", content: "SunWolf · Sun-Earth-Sentinel" },
      { name: "robots", content: "index,follow,max-image-preview:large" },

      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:secure_url", content: OG_IMAGE },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Japan–Kamchatka Monitor — Sun-Earth-Sentinel node #3",
      },
      { property: "og:locale", content: "en_US" },

      // X / Twitter — summary_large_image needs absolute https image
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: TWITTER_HANDLE },
      { name: "twitter:creator", content: TWITTER_HANDLE },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
      {
        name: "twitter:image:alt",
        content: "Japan–Kamchatka Monitor — Sun-Earth-Sentinel node #3",
      },
      // domain hint (nonstandard but some clients use it)
      { name: "twitter:url", content: SITE_URL },
      // cache-bust marker for operators
      { name: "ses:card-version", content: CARD_VERSION },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
      { rel: "canonical", href: SITE_URL },
      { rel: "image_src", href: OG_IMAGE },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/og-card-v2.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        {children}
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}
