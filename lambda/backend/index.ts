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

export const handler = async (event: BackendEvent): Promise<BackendResponse> => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  return {
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
