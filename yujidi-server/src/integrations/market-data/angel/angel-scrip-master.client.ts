import axios, { type AxiosInstance } from "axios";

import type { AngelScripMasterRow } from "./angel-scrip-master.types.js";

export const ANGEL_SCRIP_MASTER_URL =
  "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

export class AngelScripMasterClient {
  public constructor(
    private readonly httpClient: AxiosInstance = axios,
    private readonly url = ANGEL_SCRIP_MASTER_URL,
  ) {}

  public async fetchScripMaster(): Promise<AngelScripMasterRow[]> {
    const response = await this.httpClient.get<AngelScripMasterRow[]>(this.url, {
      timeout: 30000,
    });

    if (!Array.isArray(response.data)) {
      throw new Error("Angel Scrip Master response must be an array");
    }

    return response.data;
  }
}
