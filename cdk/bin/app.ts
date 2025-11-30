#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { SampleEdgeAuthStack } from "../lib/sample-edge-auth-stack";

const app = new cdk.App();

new SampleEdgeAuthStack(app, "SampleEdgeAuthStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  crossRegionReferences: true,
});
