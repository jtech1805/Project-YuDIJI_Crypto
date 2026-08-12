import axios, { type AxiosInstance } from "axios";

export type AngelLoginRequest = {
  clientCode: string;
  pin: string;
  totp: string;
  apiKey: string;
  state?: string;
};

export type AngelSessionTokens = {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  state?: string;
};

export type AngelProfile = {
  clientcode: string;
  name?: string;
  email?: string;
  mobileno?: string;
  exchanges?: string[] | string;
  products?: string[] | string;
  lastlogintime?: string;
  brokerid?: string;
};

type AngelApiEnvelope<TData> = {
  status: boolean;
  message?: string;
  errorcode?: string;
  data?: TData;
};

type AngelAuthConfig = {
  clientLocalIp?: string | undefined;
  clientPublicIp?: string | undefined;
  macAddress?: string | undefined;
  baseUrl?: string | undefined;
};

const DEFAULT_BASE_URL = "https://apiconnect.angelone.in";

export class AngelAuthService {
  private readonly baseUrl: string;

  public constructor(
    private readonly httpClient: AxiosInstance = axios,
    private readonly config: AngelAuthConfig = {
      clientLocalIp: process.env.ANGEL_CLIENT_LOCAL_IP,
      clientPublicIp: process.env.ANGEL_CLIENT_PUBLIC_IP,
      macAddress: process.env.ANGEL_MAC_ADDRESS,
    },
  ) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  public async loginByPassword(request: AngelLoginRequest): Promise<AngelSessionTokens> {
    const response = await this.httpClient.post<AngelApiEnvelope<AngelSessionTokens>>(
      `${this.baseUrl}/rest/auth/angelbroking/user/v1/loginByPassword`,
      {
        clientcode: request.clientCode,
        password: request.pin,
        totp: request.totp,
        state: request.state ?? "live",
      },
      {
        headers: this.buildHeaders(request.apiKey),
        timeout: 15000,
      },
    );

    const data = this.unwrapAngelResponse(response.data, "Angel login failed");
    if (!data.jwtToken || !data.refreshToken || !data.feedToken) {
      throw new Error("Angel login response did not include required session tokens");
    }

    return data;
  }

  public async generateTokens(apiKey: string, refreshToken: string): Promise<AngelSessionTokens> {
    const response = await this.httpClient.post<AngelApiEnvelope<AngelSessionTokens>>(
      `${this.baseUrl}/rest/auth/angelbroking/jwt/v1/generateTokens`,
      { refreshToken },
      {
        headers: this.buildHeaders(apiKey),
        timeout: 15000,
      },
    );

    const data = this.unwrapAngelResponse(response.data, "Angel token refresh failed");
    if (!data.jwtToken || !data.refreshToken || !data.feedToken) {
      throw new Error("Angel token refresh response did not include required session tokens");
    }

    return data;
  }

  public async getProfile(apiKey: string, jwtToken: string): Promise<AngelProfile> {
    const response = await this.httpClient.get<AngelApiEnvelope<AngelProfile>>(
      `${this.baseUrl}/rest/secure/angelbroking/user/v1/getProfile`,
      {
        headers: {
          ...this.buildHeaders(apiKey),
          Authorization: `Bearer ${jwtToken}`,
        },
        timeout: 15000,
      },
    );

    return this.unwrapAngelResponse(response.data, "Angel profile fetch failed");
  }

  public async logout(apiKey: string, jwtToken: string, clientCode: string): Promise<void> {
    await this.httpClient.post(
      `${this.baseUrl}/rest/secure/angelbroking/user/v1/logout`,
      { clientcode: clientCode },
      {
        headers: {
          ...this.buildHeaders(apiKey),
          Authorization: `Bearer ${jwtToken}`,
        },
        timeout: 15000,
      },
    );
  }

  private buildHeaders(apiKey: string): Record<string, string> {
    const { clientLocalIp, clientPublicIp, macAddress } = this.config;
    if (!clientLocalIp || !clientPublicIp || !macAddress) {
      throw new Error("Angel client local IP, public IP, and MAC address configuration are required");
    }

    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": clientLocalIp,
      "X-ClientPublicIP": clientPublicIp,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    };
  }

  private unwrapAngelResponse<TData>(
    response: AngelApiEnvelope<TData>,
    fallbackMessage: string,
  ): TData {
    if (!response.status || !response.data) {
      const message = response.message || fallbackMessage;
      const suffix = response.errorcode ? ` (${response.errorcode})` : "";
      throw new Error(`${message}${suffix}`);
    }

    return response.data;
  }
}
