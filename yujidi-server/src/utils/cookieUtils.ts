export const parseCookieHeader = (rawCookieHeader: string | undefined): Record<string, string> => {
  if (!rawCookieHeader) {
    return {};
  }

  return rawCookieHeader
    .split(";")
    .map((entry): string => entry.trim())
    .filter((entry): boolean => entry.length > 0)
    .reduce<Record<string, string>>((accumulator, entry): Record<string, string> => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
};
