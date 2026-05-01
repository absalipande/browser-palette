const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mibextid",
  "mc_cid",
  "mc_eid",
  "ncid",
  "rdt",
  "ref",
  "ref_src",
  "spm",
  "trk",
  "vero_id"
]);

export function normalizeUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();

      if (
        normalizedKey.startsWith("utm_") ||
        normalizedKey.startsWith("yclid") ||
        TRACKING_PARAMS.has(normalizedKey) ||
        url.searchParams.get(key) === ""
      ) {
        url.searchParams.delete(key);
      }
    }

    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/(index|default)\.(html?|php|aspx?)$/i, "/");
    url.pathname = url.pathname.replace(/\/+$/g, "");

    return url.toString().replace(/\/$/g, "");
  } catch {
    return "";
  }
}

export function prettifyUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const path = url.pathname === "/" ? "" : url.pathname;
    return `${url.hostname.replace(/^www\./, "")}${path}${url.search}`;
  } catch {
    return rawUrl;
  }
}

export function hostnameFromUrl(rawUrl: string) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
