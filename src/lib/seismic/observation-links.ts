/**
 * External observation quick-links per focus node.
 * Pattern from tonga / campi boards + JMA / KVERT / tsunami authorities.
 */

import type { FocusNodeId } from "./types";

export type ObservationLink = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  group: "authority" | "satellite" | "spaceweather" | "resonance" | "tsunami";
};

export function observationLinks(nodeId: FocusNodeId): ObservationLink[] {
  if (nodeId === "kamchatka") {
    return [
      {
        id: "usgs-km",
        title: "USGS map · Kamchatka box",
        subtitle: "7-day · M2.5+ · NW Pacific",
        href: "https://earthquake.usgs.gov/earthquakes/map/?extent=42,145&extent=62,175&range=week&magnitude=2.5&baseLayer=satellite",
        group: "authority",
      },
      {
        id: "kvert",
        title: "KVERT volcanic alerts",
        subtitle: "IVS · Kamchatka / Kurils aviation color codes",
        href: "http://www.kscnet.ru/ivs/kvert/index_eng.php",
        group: "authority",
      },
      {
        id: "gsras",
        title: "GS RAS seismic catalog",
        subtitle: "Russian Academy of Sciences · Far East",
        href: "http://www.ceme.gsras.ru/new/eng/ssd_news.htm",
        group: "authority",
      },
      {
        id: "ptwc",
        title: "PTWC Pacific tsunami",
        subtitle: "Pacific Tsunami Warning Center products",
        href: "https://www.tsunami.gov/",
        group: "tsunami",
      },
      {
        id: "firms-km",
        title: "NASA FIRMS thermal",
        subtitle: "Kamchatka volcanic hotspots",
        href: "https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@158.5,53.0,5z",
        group: "satellite",
      },
      {
        id: "s2-km",
        title: "Copernicus Sentinel-2",
        subtitle: "Kamchatka viewport",
        href: "https://browser.dataspace.copernicus.eu/?zoom=6&lat=53&lng=158.5&themeId=DEFAULT-THEME&datasetId=SENTINEL-2-L2A",
        group: "satellite",
      },
      {
        id: "swpc",
        title: "NOAA SWPC dashboard",
        subtitle: "Kp · solar wind · flares",
        href: "https://www.swpc.noaa.gov/",
        group: "spaceweather",
      },
      {
        id: "resonanceone",
        title: "ResonanceOne SR index",
        subtitle: "Live Tomsk-attributed Schumann activity index",
        href: "https://resonanceone.app/schumann-resonance-today",
        group: "resonance",
      },
    ];
  }

  // Japan arc
  return [
    {
      id: "jma-map",
      title: "JMA Bosai map",
      subtitle: "Official quake · tsunami · volcano layers",
      href: "https://www.jma.go.jp/bosai/map.html#5/36.5/138/&elem=int&lang=en",
      group: "authority",
    },
    {
      id: "jma-eq",
      title: "JMA earthquake information",
      subtitle: "Hypocenters · intensity · press releases",
      href: "https://www.jma.go.jp/bosai/map.html#5/36.5/138/&elem=eq&lang=en",
      group: "authority",
    },
    {
      id: "jma-volcano",
      title: "JMA volcano warnings",
      subtitle: "Alert levels · ash · near-crater hazard",
      href: "https://www.jma.go.jp/bosai/map.html#5/36.5/138/&elem=vol&lang=en",
      group: "authority",
    },
    {
      id: "jma-tsunami",
      title: "JMA tsunami information",
      subtitle: "Warnings · advisories · forecasts (VTSE)",
      href: "https://www.jma.go.jp/bosai/map.html#5/36.5/138/&elem=tsunami&lang=en",
      group: "tsunami",
    },
    {
      id: "ptwc",
      title: "PTWC Pacific tsunami",
      subtitle: "Pacific Tsunami Warning Center",
      href: "https://www.tsunami.gov/",
      group: "tsunami",
    },
    {
      id: "jcg-tsunami",
      title: "Japan Coast Guard",
      subtitle: "Marine safety / tsunami context",
      href: "https://www1.kaiho.mlit.go.jp/KANKYO/TIDE/turtides/en/index.html",
      group: "tsunami",
    },
    {
      id: "firms-jp",
      title: "NASA FIRMS thermal",
      subtitle: "Japan arc hotspots",
      href: "https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@138,36.5,5z",
      group: "satellite",
    },
    {
      id: "s2-jp",
      title: "Copernicus Sentinel-2",
      subtitle: "Japan viewport",
      href: "https://browser.dataspace.copernicus.eu/?zoom=5&lat=36.5&lng=138&themeId=DEFAULT-THEME&datasetId=SENTINEL-2-L2A",
      group: "satellite",
    },
    {
      id: "swpc",
      title: "NOAA SWPC dashboard",
      subtitle: "Kp · solar wind · flares",
      href: "https://www.swpc.noaa.gov/",
      group: "spaceweather",
    },
    {
      id: "resonanceone",
      title: "ResonanceOne SR index",
      subtitle: "Live Tomsk-attributed Schumann activity index",
      href: "https://resonanceone.app/schumann-resonance-today",
      group: "resonance",
    },
  ];
}
