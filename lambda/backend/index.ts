import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const ACCESS_TOKEN_COOKIE_NAME = "accessToken";

function hasAccessTokenCookie(cookieHeader: string | undefined): boolean {
  console.log("Checking cookie header:", cookieHeader);
  if (!cookieHeader) return false;

  // Cookie: a=b; accessToken=xxx; c=d
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Name-only cookies are unusual but ignore safely
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 0) continue;

    const name = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();

    if (name === ACCESS_TOKEN_COOKIE_NAME && value.length > 0) {
      return true;
    }
  }

  return false;
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const cookieHeader = event.headers?.cookie ?? event.headers?.Cookie;
  const ok = hasAccessTokenCookie(cookieHeader);

  return {
    statusCode: ok ? 200 : 400,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ ok }),
  };
};
