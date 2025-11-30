import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import * as path from "path";

export class SampleEdgeAuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ===========================================
    // 3.1 Cognito User Pool の定義
    // ===========================================
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "sample-edge-auth-user-pool",
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Domain（Cognitoホストド UI用）
    const userPoolDomain = userPool.addDomain("UserPoolDomain", {
      cognitoDomain: {
        domainPrefix: `sample-edge-auth-${cdk.Aws.ACCOUNT_ID}`,
      },
    });

    // ===========================================
    // 3.3 S3バケットの定義
    // ===========================================
    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ===========================================
    // 3.4 Lambda@Edge関数の定義（NodejsFunctionでバンドル）
    // ===========================================
    const authFunction = new cloudfront.experimental.EdgeFunction(this, "AuthFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../lambda/auth"), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          local: {
            tryBundle(outputDir: string) {
              const execSync = require("child_process").execSync;
              try {
                execSync(`npx esbuild index.ts --bundle --platform=node --target=node20 --outfile=${outputDir}/index.js --external:@aws-sdk/*`, {
                  cwd: path.join(__dirname, "../../lambda/auth"),
                  stdio: "inherit",
                });
                return true;
              } catch {
                return false;
              }
            },
          },
          command: [
            "bash",
            "-c",
            [
              "npm install",
              "npm install esbuild",
              "npx esbuild index.ts --bundle --platform=node --target=node20 --outfile=/asset-output/index.js --external:@aws-sdk/*",
            ].join(" && "),
          ],
          user: "root",
        },
      }),
      timeout: cdk.Duration.seconds(5),
      memorySize: 128,
    });

    // Lambda@EdgeにSSM Parameter Store読み取り権限を付与
    // Lambda@Edgeはus-east-1で実行されるが、SSMパラメータはap-northeast-1に存在するため
    // 明示的にap-northeast-1リージョンを指定する
    authFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [`arn:aws:ssm:ap-northeast-1:${cdk.Aws.ACCOUNT_ID}:parameter/sample-edge-auth/*`],
      })
    );

    // ===========================================
    // 3.5 CloudFront Distributionの定義
    // ===========================================
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        edgeLambdas: [
          {
            functionVersion: authFunction.currentVersion,
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          },
        ],
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    // ===========================================
    // 3.1 (続き) App Client作成（CloudFrontドメイン確定後）
    // ===========================================
    const cloudFrontUrl = `https://${distribution.distributionDomainName}`;

    const userPoolClient = userPool.addClient("UserPoolClient", {
      userPoolClientName: "sample-edge-auth-client",
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: [cloudFrontUrl, `${cloudFrontUrl}/`],
        logoutUrls: [cloudFrontUrl, `${cloudFrontUrl}/`],
      },
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });

    // ===========================================
    // 3.2 SSM Parameter Store の定義（us-east-1）
    // ===========================================
    // Lambda@Edgeはus-east-1で実行されるため、パラメータもus-east-1に作成
    const cognitoRegion = new ssm.StringParameter(this, "CognitoRegion", {
      parameterName: "/sample-edge-auth/cognito-region",
      stringValue: cdk.Aws.REGION,
    });

    const userPoolIdParam = new ssm.StringParameter(this, "UserPoolIdParam", {
      parameterName: "/sample-edge-auth/user-pool-id",
      stringValue: userPool.userPoolId,
    });

    const userPoolAppIdParam = new ssm.StringParameter(this, "UserPoolAppId", {
      parameterName: "/sample-edge-auth/user-pool-app-id",
      stringValue: userPoolClient.userPoolClientId,
    });

    const userPoolDomainParam = new ssm.StringParameter(this, "UserPoolDomainParam", {
      parameterName: "/sample-edge-auth/user-pool-domain",
      stringValue: `${userPoolDomain.domainName}.auth.${cdk.Aws.REGION}.amazoncognito.com`,
    });

    // ===========================================
    // フロントエンドのデプロイ
    // ===========================================
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../frontend/dist"))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // ===========================================
    // Outputs
    // ===========================================
    new cdk.CfnOutput(this, "CloudFrontURL", {
      value: cloudFrontUrl,
      description: "CloudFront Distribution URL",
    });

    new cdk.CfnOutput(this, "UserPoolIdOutput", {
      value: userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolClientIdOutput", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });

    new cdk.CfnOutput(this, "CognitoLoginURL", {
      value: `https://${userPoolDomain.domainName}.auth.${cdk.Aws.REGION}.amazoncognito.com/login?client_id=${
        userPoolClient.userPoolClientId
      }&response_type=code&scope=email+openid+profile&redirect_uri=${encodeURIComponent(cloudFrontUrl + "/")}`,
      description: "Cognito Hosted UI Login URL",
    });
  }
}
