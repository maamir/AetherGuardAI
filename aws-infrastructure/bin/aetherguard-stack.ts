#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AetherGuardStack } from '../lib/aetherguard-stack';
import { AetherGuardNetworkStack } from '../lib/network-stack';
import { AetherGuardStorageStack } from '../lib/storage-stack';
import { AetherGuardComputeStack } from '../lib/compute-stack';
import { AetherGuardMonitoringStack } from '../lib/monitoring-stack';
import { AetherGuardAnalyticsStack } from '../lib/analytics-stack';
import { AetherGuardCdnStack } from '../lib/cdn-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Network Stack (VPC, Subnets, Security Groups)
const networkStack = new AetherGuardNetworkStack(app, 'AetherGuardNetworkStack', {
  env,
  description: 'AetherGuard AI - Network Infrastructure',
});

// Storage Stack (S3, DynamoDB, QLDB, KMS)
const storageStack = new AetherGuardStorageStack(app, 'AetherGuardStorageStack', {
  env,
  description: 'AetherGuard AI - Storage and Data Services',
});

// Compute Stack (ECS/Fargate, ALB, Auto Scaling)
const computeStack = new AetherGuardComputeStack(app, 'AetherGuardComputeStack', {
  env,
  description: 'AetherGuard AI - Compute Resources',
  vpc: networkStack.vpc,
  kmsKey: storageStack.kmsKey,
  auditTable: storageStack.qldbLedger,
  policyTable: storageStack.policyTable,
  logBucket: storageStack.logBucket,
});

// Monitoring Stack (CloudWatch, Alarms, Dashboards)
const monitoringStack = new AetherGuardMonitoringStack(app, 'AetherGuardMonitoringStack', {
  env,
  description: 'AetherGuard AI - Monitoring and Observability',
  cluster: computeStack.cluster,
  loadBalancer: computeStack.loadBalancer,
});

// Main Stack (API Gateway, Lambda, Cognito)
const mainStack = new AetherGuardStack(app, 'AetherGuardMainStack', {
  env,
  description: 'AetherGuard AI - Main Application Stack',
  vpc: networkStack.vpc,
  cluster: computeStack.cluster,
  kmsKey: storageStack.kmsKey,
  userPool: storageStack.userPool,
});

// Analytics Stack (Kinesis, Athena, Glue)
const analyticsStack = new AetherGuardAnalyticsStack(app, 'AetherGuardAnalyticsStack', {
  env,
  description: 'AetherGuard AI - Analytics and Data Pipeline',
  logBucket: storageStack.logBucket,
  kmsKey: storageStack.kmsKey,
});

// CDN Stack (CloudFront, Global Accelerator, WAF)
const cdnStack = new AetherGuardCdnStack(app, 'AetherGuardCdnStack', {
  env,
  description: 'AetherGuard AI - CDN and Edge Services',
  loadBalancer: computeStack.loadBalancer,
  // Optional: domainName: 'example.com', hostedZoneId: 'Z1234567890ABC'
});

// Add dependencies
computeStack.addDependency(networkStack);
computeStack.addDependency(storageStack);
monitoringStack.addDependency(computeStack);
mainStack.addDependency(computeStack);
analyticsStack.addDependency(storageStack);
cdnStack.addDependency(computeStack);

// Tags
cdk.Tags.of(app).add('Project', 'AetherGuard');
cdk.Tags.of(app).add('Environment', process.env.ENVIRONMENT || 'production');
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
