type BackendEvent = {
  resourcePath?: string;
  httpMethod?: string;
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
  };
  user: {
    sub: string;
    username: string;
  };
};

export const handler = async (event: BackendEvent): Promise<BackendResponse> => {
  return {
    message: "Hello from Lambda backend!",
    request: {
      resourcePath: event.resourcePath ?? "",
      httpMethod: event.httpMethod ?? "",
    },
    user: {
      sub: event.authorizer?.sub ?? "",
      username: event.authorizer?.username ?? "",
    },
  };
};
