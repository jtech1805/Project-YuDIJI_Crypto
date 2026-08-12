export type HistoricalIdentity<T> = Readonly<{
  id: string;
  version: number;
  value: T;
}>;

export class ImmutableHistoricalAuthority<T> {
  private readonly values: ReadonlyMap<string, T>;
  private readonly versions: ReadonlyMap<string, readonly number[]>;

  public constructor(entries: readonly HistoricalIdentity<T>[]) {
    const values = new Map<string, T>();
    const versions = new Map<string, number[]>();
    for (const entry of entries) {
      values.set(key(entry.id, entry.version), cloneAndFreeze(entry.value));
      const found = versions.get(entry.id) ?? [];
      found.push(entry.version);
      versions.set(entry.id, found);
    }
    for (const found of versions.values()) Object.freeze(found.sort((a, b) => a - b));
    this.values = values;
    this.versions = versions;
  }

  public getExact(id: string, version: number): T | null {
    const value = this.values.get(key(id, version));
    return value === undefined ? null : cloneAndFreeze(value);
  }

  public getLatest(id: string): T | null {
    const versions = this.versions.get(id);
    const latest = versions?.[versions.length - 1];
    return latest === undefined ? null : this.getExact(id, latest);
  }

  public listVersions(id: string): readonly T[] {
    return Object.freeze((this.versions.get(id) ?? []).map((version) => this.getExact(id, version)!));
  }
}

export const cloneAndFreeze = <T>(value: T): T => deepFreeze(structuredClone(value));

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};
const key = (id: string, version: number) => `${id}:${version}`;
