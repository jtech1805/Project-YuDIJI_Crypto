import axios from "axios";
import pino from "pino";

const logger = pino({ name: "news-service" });

interface CryptoCompareArticle {
  title: string;
}

interface CryptoCompareResponse {
  Data?: CryptoCompareArticle[];
}

const stripQuoteAsset = (symbol: string): string => {
  return symbol.replace(/USDT$/i, "").replace(/USD$/i, "").toUpperCase();
};

export const fetchRecentHeadlines = async (symbol: string): Promise<string> => {
  const baseSymbol = stripQuoteAsset(symbol);
  const requestUrl = `https://min-api.cryptocompare.com/data/v2/news/?categories=${baseSymbol}&excludeCategories=Sponsored`;

  try {
    logger.info(
      {
        event: "CRYPTOCOMPARE_REQUEST_START",
        symbol,
        baseSymbol,
        requestUrl,
      },
      `Fetching news from CryptoCompare for ${baseSymbol}`,
    );

    const response = await axios.get<CryptoCompareResponse>(requestUrl, {
      headers: {
        authorization: `Apikey ${process.env.CRYPTOCOMPARE_API_KEY ?? ""}`,
      },
      timeout: 12000,
    });

    const headlines = (response.data.Data ?? [])
      .slice(0, 10)
      .map((article): string => article.title)
      .filter((title): boolean => title.trim().length > 0);

    logger.info(
      {
        event: "CRYPTOCOMPARE_REQUEST_SUCCESS",
        symbol,
        baseSymbol,
        httpStatus: response.status,
        totalArticlesReceived: response.data.Data?.length ?? 0,
        headlinesExtracted: headlines.length,
      },
      "CryptoCompare headlines fetched successfully",
    );

    if (headlines.length === 0) {
      logger.warn(
        {
          event: "CRYPTOCOMPARE_EMPTY_RESULT",
          symbol,
          baseSymbol,
        },
        "No headlines returned by CryptoCompare",
      );
      return "No recent news available.";
    }

    return headlines.join("\n");
  } catch (error: unknown) {
    logger.warn(
      {
        event: "CRYPTOCOMPARE_REQUEST_FAILED",
        error,
        symbol,
        baseSymbol,
        requestUrl,
      },
      "Failed to fetch CryptoCompare headlines",
    );
    return "No recent news available.";
  }
};
