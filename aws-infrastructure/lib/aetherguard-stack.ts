import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface AetherGuardStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  cluster: ecs.Cluster;
  kmsKey: kms.Key;
  userPool: cognito.UserPool;
}

export class AetherGuardStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly controlPlaneLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: AetherGuardStackProps) {
    super(scope, id, props);

    // ===== Lambda Functions for Control Plane =====

    // Policy Management Lambda
    const policyLambda = new lambda.Function(this, 'PolicyManagementLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'policy.handler',
      code: lambda.Code.fromAsset('../lambda/policy'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        KMS_KEY_ID: props.kmsKey.keyId,
        USER_POOL_ID: props.userPool.userPoolId,
      },
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Budget Management Lambda
    const budgetLambda = new lambda.Function(this, 'BudgetManagementLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'budget.handler',
      code: lambda.Code.fromAsset('../lambda/budget'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        KMS_KEY_ID: props.kmsKey.keyId,
      },
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Audit Query Lambda
    const auditLambda = new lambda.Function(this, 'AuditQueryLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'audit.handler',
      code: lambda.Code.fromAsset('../lambda/audit'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        KMS_KEY_ID: props.kmsKey.keyId,
      },
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Analytics Lambda
    const analyticsLambda = new lambda.Function(this, 'AnalyticsLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'analytics.handler',
      code: lambda.Code.fromAsset('../lambda/analytics'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      environment: {
        KMS_KEY_ID: props.kmsKey.keyId,
      },
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant permissions
    props.kmsKey.grantEncryptDecrypt(policyLambda);
    props.kmsKey.grantEncryptDecrypt(budgetLambda);
    props.kmsKey.grantEncryptDecrypt(auditLambda);
    props.kmsKey.grantEncryptDecrypt(analyticsLambda);

    // ===== API Gateway =====

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: 'AetherGuardAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    // REST API
    this.api = new apigateway.RestApi(this, 'AetherGuardAPI', {
      restApiName: 'AetherGuard Control Plane API',
      description: 'API for managing AetherGuard AI firewall',
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      cloudWatchRole: true,
    });

    // ===== API Resources and Methods =====

    // /policies
    const policiesResource = this.api.root.addResource('policies');
    policiesResource.addMethod('GET', new apigateway.LambdaIntegration(policyLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    policiesResource.addMethod('POST', new apigateway.LambdaIntegration(policyLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const policyResource = policiesResource.addResource('{policyId}');
    policyResource.addMethod('GET', new apigateway.LambdaIntegration(policyLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    policyResource.addMethod('PUT', new apigateway.LambdaIntegration(policyLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    policyResource.addMethod('DELETE', new apigateway.LambdaIntegration(policyLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /budgets
    const budgetsResource = this.api.root.addResource('budgets');
    budgetsResource.addMethod('GET', new apigateway.LambdaIntegration(budgetLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    budgetsResource.addMethod('POST', new apigateway.LambdaIntegration(budgetLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const budgetResource = budgetsResource.addResource('{userId}');
    budgetResource.addMethod('GET', new apigateway.LambdaIntegration(budgetLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    budgetResource.addMethod('PUT', new apigateway.LambdaIntegration(budgetLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /audit
    const auditResource = this.api.root.addResource('audit');
    auditResource.addMethod('GET', new apigateway.LambdaIntegration(auditLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const auditQueryResource = auditResource.addResource('query');
    auditQueryResource.addMethod('POST', new apigateway.LambdaIntegration(auditLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /analytics
    const analyticsResource = this.api.root.addResource('analytics');
    analyticsResource.addMethod('GET', new apigateway.LambdaIntegration(analyticsLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const analyticsReportResource = analyticsResource.addResource('report');
    analyticsReportResource.addMethod('POST', new apigateway.LambdaIntegration(analyticsLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /health (public endpoint)
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          'application/json': '{"status": "healthy", "timestamp": "$context.requestTime"}',
        },
      }],
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      methodResponses: [{ statusCode: '200' }],
    });

    // ===== API Keys and Usage Plans for Multi-Tier Rate Limiting =====
    
    // Free tier (10 req/sec, 10K/month)
    const freeApiKey = this.api.addApiKey('FreeApiKey', {
      apiKeyName: 'AetherGuard-Free-Key',
      description: 'API key for free tier',
    });

    const freePlan = this.api.addUsagePlan('FreePlan', {
      name: 'AetherGuard-Free',
      description: 'Free tier: 10 req/sec, 10K requests/month',
      throttle: {
        rateLimit: 10,
        burstLimit: 20,
      },
      quota: {
        limit: 10000,
        period: apigateway.Period.MONTH,
      },
    });

    freePlan.addApiKey(freeApiKey);
    freePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // Starter tier (100 req/sec, 1M/month)
    const starterApiKey = this.api.addApiKey('StarterApiKey', {
      apiKeyName: 'AetherGuard-Starter-Key',
      description: 'API key for starter tier',
    });

    const starterPlan = this.api.addUsagePlan('StarterPlan', {
      name: 'AetherGuard-Starter',
      description: 'Starter tier: 100 req/sec, 1M requests/month',
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 1000000,
        period: apigateway.Period.MONTH,
      },
    });

    starterPlan.addApiKey(starterApiKey);
    starterPlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // Professional tier (1000 req/sec, 10M/month)
    const professionalApiKey = this.api.addApiKey('ProfessionalApiKey', {
      apiKeyName: 'AetherGuard-Professional-Key',
      description: 'API key for professional tier',
    });

    const professionalPlan = this.api.addUsagePlan('ProfessionalPlan', {
      name: 'AetherGuard-Professional',
      description: 'Professional tier: 1000 req/sec, 10M requests/month',
      throttle: {
        rateLimit: 1000,
        burstLimit: 2000,
      },
      quota: {
        limit: 10000000,
        period: apigateway.Period.MONTH,
      },
    });

    professionalPlan.addApiKey(professionalApiKey);
    professionalPlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // Enterprise tier (10000 req/sec, unlimited)
    const enterpriseApiKey = this.api.addApiKey('EnterpriseApiKey', {
      apiKeyName: 'AetherGuard-Enterprise-Key',
      description: 'API key for enterprise tier',
    });

    const enterprisePlan = this.api.addUsagePlan('EnterprisePlan', {
      name: 'AetherGuard-Enterprise',
      description: 'Enterprise tier: 10000 req/sec, unlimited requests',
      throttle: {
        rateLimit: 10000,
        burstLimit: 20000,
      },
      // No quota limit for enterprise
    });

    enterprisePlan.addApiKey(enterpriseApiKey);
    enterprisePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // Service-to-service API key (backward compatibility)
    const apiKey = this.api.addApiKey('ServiceApiKey', {
      apiKeyName: 'AetherGuardServiceKey',
      description: 'API key for service-to-service communication',
    });

    const usagePlan = this.api.addUsagePlan('UsagePlan', {
      name: 'AetherGuardUsagePlan',
      throttle: {
        rateLimit: 10000,
        burstLimit: 20000,
      },
      quota: {
        limit: 1000000,
        period: apigateway.Period.MONTH,
      },
    });

    usagePlan.addApiKey(apiKey);
    usagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // ===== Outputs =====
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'AetherGuardApiEndpoint',
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: 'AetherGuardApiId',
    });

    // API Key outputs
    new cdk.CfnOutput(this, 'FreeApiKeyId', {
      value: freeApiKey.keyId,
      description: 'Free tier API key ID',
    });

    new cdk.CfnOutput(this, 'StarterApiKeyId', {
      value: starterApiKey.keyId,
      description: 'Starter tier API key ID',
    });

    new cdk.CfnOutput(this, 'ProfessionalApiKeyId', {
      value: professionalApiKey.keyId,
      description: 'Professional tier API key ID',
    });

    new cdk.CfnOutput(this, 'EnterpriseApiKeyId', {
      value: enterpriseApiKey.keyId,
      description: 'Enterprise tier API key ID',
    });

    // Usage plan outputs
    new cdk.CfnOutput(this, 'RateLimitTiers', {
      value: JSON.stringify({
        free: '10 req/sec, 10K/month',
        starter: '100 req/sec, 1M/month',
        professional: '1000 req/sec, 10M/month',
        enterprise: '10000 req/sec, unlimited',
      }),
      description: 'Rate limit tiers configuration',
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID for service authentication',
      exportName: 'AetherGuardApiKeyId',
    });

    this.controlPlaneLambda = policyLambda;
  }
}
