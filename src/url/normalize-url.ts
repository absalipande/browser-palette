const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "spm"
]);

export function normalizeUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }

    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
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
