import { readFile } from "node:fs/promises";

import axios, { type AxiosInstance } from "axios";

import type { AngelScripMasterRow } from "./angel-scrip-master.types.js";

export const ANGEL_SCRIP_MASTER_URL =
  "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

type AngelScripMasterClientOptions = {
  url?: string;
  filePath?: string;
};

const validateScripMasterRows = (value: unknown): AngelScripMasterRow[] => {
  if (!Array.isArray(value)) {
    throw new Error("Angel Scrip Master response must be an array");
  }

  return value as AngelScripMasterRow[];
};

export class AngelScripMasterClient {
  private readonly url: string;
  private readonly filePath: string | undefined;

  public constructor(
    private readonly httpClient: AxiosInstance = axios,
    options: AngelScripMasterClientOptions = {},
  ) {
    this.url = options.url?.trim()
      || process.env.ANGEL_SCRIP_MASTER_URL?.trim()
      || ANGEL_SCRIP_MASTER_URL;
    this.filePath = options.filePath?.trim()
      || process.env.ANGEL_SCRIP_MASTER_FILE?.trim()
      || undefined;
  }

  public async fetchScripMaster(): Promise<AngelScripMasterRow[]> {
    if (this.filePath) {
      const rawFile = await readFile(this.filePath, "utf8");
      return validateScripMasterRows(JSON.parse(rawFile));
    }

    const response = await this.httpClient.get<AngelScripMasterRow[]>(this.url, {
      timeout: 30000,
    });

    return validateScripMasterRows(response.data);
  }
}
