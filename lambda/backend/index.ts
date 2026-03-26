type BackendEvent = {
  resourcePath?: string;
  httpMethod?: string;
  headers?: {
    origin?: string;
  };
  authorizer?: {
    sub?: string;
    username?: string;
  };
};

type BackendResponse = {
  accessControlAllowOrigin: string;
  message: string;
  request: {
    resourcePath: string;
    httpMethod: string;
    origin: string;
  };
  user: {
    sub: string;
    username: string;
  };
};

function resolveAllowedOrigin(origin?: string): string {
  const cloudFrontUrl = process.env.CLOUD_FRONT_URL ?? "";

  if (!origin) {
    return cloudFrontUrl;
  }

  if (origin.startsWith("http://localhost") || origin.startsWith("https://localhost")) {
    return origin;
  }

  return cloudFrontUrl;
}

export const handler = async (event: BackendEvent): Promise<BackendResponse> => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  return {
    accessControlAllowOrigin: resolveAllowedOrigin(event.headers?.origin),
    message: "Hello from Lambda backend!",
    request: {
      resourcePath: event.resourcePath ?? "",
      httpMethod: event.httpMethod ?? "",
      origin: event.headers?.origin ?? "",
    },
    user: {
      sub: event.authorizer?.sub ?? "",
      username: event.authorizer?.username ?? "",
    },
  };
};
