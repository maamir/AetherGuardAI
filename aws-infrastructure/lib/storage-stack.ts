import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as qldb from 'aws-cdk-lib/aws-qldb';
import { Construct } from 'constructs';

export class AetherGuardStorageStack extends cdk.Stack {
  public readonly logBucket: s3.Bucket;
  public readonly modelBucket: s3.Bucket;
  public readonly policyTable: dynamodb.Table;
  public readonly budgetTable: dynamodb.Table;
  public readonly kmsKey: kms.Key;
  public readonly userPool: cognito.UserPool;
  public readonly qldbLedger: qldb.CfnLedger;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // KMS Key for encryption
    this.kmsKey = new kms.Key(this, 'AetherGuardKMSKey', {
      description: 'AetherGuard AI encryption key',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      alias: 'aetherguard/main',
    });

    // S3 Bucket for logs
    this.logBucket = new s3.Bucket(this, 'LogBucket', {
      bucketName: `aetherguard-logs-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
          enabled: true,
          expiration: cdk.Duration.days(90),
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(60),
            },
          ],
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // S3 Bucket for model artifacts
    this.modelBucket = new s3.Bucket(this, 'ModelBucket', {
      bucketName: `aetherguard-models-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // DynamoDB Table for policies
    this.policyTable = new dynamodb.Table(this, 'PolicyTable', {
      tableName: 'AetherGuardPolicies',
      partitionKey: {
        name: 'policyId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'version',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Global Secondary Index for policy lookup by name
    this.policyTable.addGlobalSecondaryIndex({
      indexName: 'PolicyNameIndex',
      partitionKey: {
        name: 'policyName',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // DynamoDB Table for user budgets
    this.budgetTable = new dynamodb.Table(this, 'BudgetTable', {
      tableName: 'AetherGuardBudgets',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl',
    });

    // QLDB Ledger for audit logs
    this.qldbLedger = new qldb.CfnLedger(this, 'AuditLedger', {
      name: 'AetherGuardAuditLedger',
      permissionsMode: 'STANDARD',
      deletionProtection: true,
      kmsKey: this.kmsKey.keyArn,
    });

    // Cognito User Pool for authentication
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'AetherGuardUsers',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // User Pool Client
    const userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'AetherGuardWebClient',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
      },
    });

    // User Pool Domain
    this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `aetherguard-${this.account}`,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'LogBucketName', {
      value: this.logBucket.bucketName,
      description: 'S3 bucket for logs',
      exportName: 'AetherGuardLogBucket',
    });

    new cdk.CfnOutput(this, 'ModelBucketName', {
      value: this.modelBucket.bucketName,
      description: 'S3 bucket for models',
      exportName: 'AetherGuardModelBucket',
    });

    new cdk.CfnOutput(this, 'PolicyTableName', {
      value: this.policyTable.tableName,
      description: 'DynamoDB table for policies',
      exportName: 'AetherGuardPolicyTable',
    });

    new cdk.CfnOutput(this, 'BudgetTableName', {
      value: this.budgetTable.tableName,
      description: 'DynamoDB table for budgets',
      exportName: 'AetherGuardBudgetTable',
    });

    new cdk.CfnOutput(this, 'KMSKeyId', {
      value: this.kmsKey.keyId,
      description: 'KMS key ID',
      exportName: 'AetherGuardKMSKeyId',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'AetherGuardUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'AetherGuardUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'QLDBLedgerName', {
      value: this.qldbLedger.name!,
      description: 'QLDB Ledger name',
      exportName: 'AetherGuardQLDBLedger',
    });
  }
}
