import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const authorizerContext = event.requestContext.authorizer;

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: "Hello from Lambda backend!",
      user: {
        sub: (authorizerContext?.sub as string | undefined) ?? "",
        username: (authorizerContext?.username as string | undefined) ?? "",
      },
    }),
  };
};
