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

  const cfDomain = event.Records[0].cf.request.headers.host[0].value;

  const logoutReturnTo = `https://${cfDomain}/`;
  const cognitoLogoutUrl = `https://${cachedAuthParams.userPoolDomain}/logout?client_id=${cachedAuthParams.userPoolAppId}&logout_uri=${encodeURIComponent(
    logoutReturnTo
  )}`;

  // logoutRedirectUri は Host に依存するため、リクエスト毎に Authenticator を生成する
  return new Authenticator({
    ...cachedAuthParams,
    logoutConfiguration: {
      // /signout へのアクセスをログアウトとして扱う
      logoutUri: "/signout",
      // Cookie を削除した後、Cognito Hosted UI の /logout に遷移させて
      // Cognito 側セッションもクリアする（これをしないと再ログイン時に UI が表示されず
      // そのまま code 発行→Cookie 再取得、となることがある）
      logoutRedirectUri: cognitoLogoutUrl,
    },
    cookieExpirationDays: 1,
    httpOnly: true,
    sameSite: "Lax",
    logLevel: "warn",
  });
}

// Lambda@Edge ハンドラー
export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> => {
  const { request } = event.Records[0].cf;

  // リダイレクト専用ページは認証対象外（ここに到達できないと param 保存ができない）
  if (request.uri === "/redirect.html") {
    return request;
  }

  const auth = await initAuthenticator(event);
  return auth.handle(event);
};
