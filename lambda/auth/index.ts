import { CloudFrontRequestEvent, CloudFrontRequestResult } from "aws-lambda";
import { Authenticator } from "cognito-at-edge";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

// SSMクライアント（ap-northeast-1リージョン - パラメータが格納されているリージョン）
const ssmClient = new SSMClient({ region: "ap-northeast-1" });

// パラメータキャッシュ
let authenticator: Authenticator | null = null;

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
async function initAuthenticator(): Promise<Authenticator> {
  if (authenticator) {
    return authenticator;
  }

  const [region, userPoolId, userPoolAppId, userPoolDomain] = await Promise.all([
    getParameter("/sample-edge-auth/cognito-region"),
    getParameter("/sample-edge-auth/user-pool-id"),
    getParameter("/sample-edge-auth/user-pool-app-id"),
    getParameter("/sample-edge-auth/user-pool-domain"),
  ]);

  authenticator = new Authenticator({
    region,
    userPoolId,
    userPoolAppId,
    userPoolDomain,
    cookieExpirationDays: 1,
    httpOnly: true,
    sameSite: "Lax",
    logLevel: "warn",
  });

  return authenticator;
}

// Lambda@Edge ハンドラー
export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontRequestResult> => {
  const auth = await initAuthenticator();
  return auth.handle(event);
};
