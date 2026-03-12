import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent } from "aws-lambda";

const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;

// Cognito アクセストークン検証用 Verifier（JWKS は自動フェッチ＆キャッシュ）
const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: "access",
  clientId: CLIENT_ID,
});

/**
 * Cookie ヘッダ文字列（"k1=v1; k2=v2; ..."）をパースする。
 * REST API 経由の Lambda Authorizer から Cookie を抽出する。
 */
function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eqIndex = part.indexOf("=");
    if (eqIndex > 0) {
      const key = part.substring(0, eqIndex).trim();
      const value = part.substring(eqIndex + 1).trim();
      result[key] = value;
    }
  }
  return result;
}

/**
 * REST API の Lambda Authorizer event から Cookie を抽出する。
 */
function extractCookies(event: APIGatewayRequestAuthorizerEvent): Record<string, string> {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie;
  if (cookieHeader) {
    return parseCookieHeader(cookieHeader);
  }
  return {};
}

function findAccessToken(cookies: Record<string, string>): string | undefined {
  const lastAuthUserKey = `CognitoIdentityServiceProvider.${CLIENT_ID}.LastAuthUser`;
  const lastAuthUser = cookies[lastAuthUserKey];

  if (lastAuthUser) {
    const accessTokenKey = `CognitoIdentityServiceProvider.${CLIENT_ID}.${lastAuthUser}.accessToken`;
    return cookies[accessTokenKey];
  }

  const prefix = `CognitoIdentityServiceProvider.${CLIENT_ID}.`;
  for (const [key, value] of Object.entries(cookies)) {
    if (key.startsWith(prefix) && key.endsWith(".accessToken") && value) {
      return value;
    }
  }

  return undefined;
}

/**
 * Lambda Authorizer ハンドラ
 *
 * cognito-at-edge が設定する Cookie から Cognito アクセストークンを取り出し、
 * aws-jwt-verify で JWT 署名・有効期限・audience 等を検証する。
 *
 * Cookie 名のパターン:
 *   CognitoIdentityServiceProvider.<clientId>.LastAuthUser        = <username>
 *   CognitoIdentityServiceProvider.<clientId>.<username>.accessToken = <JWT>
 */
export const handler = async (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  console.log("Authorizer invoked", {
    path: event.path,
    hasCookies: !!(event.headers?.cookie || event.headers?.Cookie),
  });

  try {
    const cookies = extractCookies(event);

    // 1. アクセストークン Cookie を取得
    const accessToken = findAccessToken(cookies);

    if (!accessToken) {
      console.log("accessToken cookie not found");
      return buildPolicy("anonymous", "Deny", event.methodArn);
    }

    // 3. JWT を検証（署名・有効期限・client_id・token_use を自動チェック）
    const payload = await verifier.verify(accessToken);
    console.log("Token verified", { sub: payload.sub, username: payload.username });

    return buildPolicy(payload.sub, "Allow", event.methodArn, {
      sub: payload.sub,
      username: (payload.username as string) ?? "",
    });
  } catch (err) {
    console.error("Authorization failed", err);
    return buildPolicy("anonymous", "Deny", event.methodArn);
  }
};

function buildPolicy(principalId: string, effect: "Allow" | "Deny", resource: string, context: Record<string, string> = {}): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };
}
