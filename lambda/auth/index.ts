import { CloudFrontRequestEvent, CloudFrontRequestResult } from "aws-lambda";
import { Authenticator } from "cognito-at-edge";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

// SSMクライアント（ap-northeast-1リージョン - パラメータが格納されているリージョン）
const ssmClient = new SSMClient({ region: "ap-northeast-1" });

// パラメータキャッシュ（SSMの取得はコストがあるため、値のみをキャッシュする）
let cachedAuthParams: {
  region: string;
  userPoolId: string;
  userPoolAppId: string;
  userPoolDomain: string;
} | null = null;

// SSM Parameter Storeからパラメータを取得
async function getParameter(name: string): Promise<string> {
  const command = new GetParameterCommand({
    Name: name,
    WithDecryption: true,
  });
  const response = await ssmClient.send(command);
  return response.Parameter?.Value || "";
}

// Authenticatorを初期化
async function initAuthenticator(event: CloudFrontRequestEvent): Promise<Authenticator> {
  if (!cachedAuthParams) {
    const [region, userPoolId, userPoolAppId, userPoolDomain] = await Promise.all([
      getParameter("/sample-edge-auth/cognito-region"),
      getParameter("/sample-edge-auth/user-pool-id"),
      getParameter("/sample-edge-auth/user-pool-app-id"),
      getParameter("/sample-edge-auth/user-pool-domain"),
    ]);

    cachedAuthParams = {
      region,
      userPoolId,
      userPoolAppId,
      userPoolDomain,
    };
  }

  const { request } = event.Records[0].cf;
  const cfDomain = request.headers.host[0].value;

  // logoutRedirectUri は Host に依存するため、リクエスト毎に Authenticator を生成する
  return new Authenticator({
    ...cachedAuthParams,
    logoutConfiguration: {
      // /signout へのアクセスをログアウトとして扱う
      logoutUri: "/signout",
      // ログアウト後は同一オリジンのルートへ戻す（Cookieが消えるので再アクセス時は再認証へ）
      logoutRedirectUri: `https://${cfDomain}`,
    },
    cookieExpirationDays: 1,
    httpOnly: true,
    sameSite: "Lax",
    logLevel: "warn",
  });
}

// Lambda@Edge ハンドラー
export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> => {
  const auth = await initAuthenticator(event);
  return auth.handle(event);
};
