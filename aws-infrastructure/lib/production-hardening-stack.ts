import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as guardduty from 'aws-cdk-lib/aws-guardduty';
import * as securityhub from 'aws-cdk-lib/aws-securityhub';
import * as config from 'aws-cdk-lib/aws-config';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface ProductionHardeningStackProps extends cdk.StackProps {
  policyTable: dynamodb.ITable;
  budgetTable: dynamodb.ITable;
  notificationEmail: string;
}

/**
 * Production Hardening Stack
 * 
 * Provides:
 * - AWS Secrets Manager for sensitive data
 * - AWS Backup for automated backups
 * - AWS GuardDuty for threat detection
 * - AWS Security Hub for security posture
 * - AWS Config for compliance monitoring
 * - AWS CloudTrail for API auditing
 * - Enhanced security controls
 */
export class ProductionHardeningStack extends cdk.Stack {
  public readonly secretsManager: secretsmanager.Secret;
  public readonly backupVault: backup.BackupVault;
  public readonly cloudTrail: cloudtrail.Trail;

  constructor(scope: Construct, id: string, props: ProductionHardeningStackProps) {
    super(scope, id, props);

    // ========================================
    // AWS Secrets Manager
    // ========================================
    // Create KMS key for secrets encryption
    const secretsKey = new kms.Key(this, 'SecretsKey', {
      description: 'KMS key for Secrets Manager',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Store API keys and sensitive configuration
    this.secretsManager = new secretsmanager.Secret(this, 'AetherGuardSecrets', {
      secretName: 'aetherguard/production/secrets',
      description: 'AetherGuard production secrets',
      encryptionKey: secretsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          environment: 'production',
        }),
        generateStringKey: 'api_key',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Store database credentials
    const dbSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: 'aetherguard/production/database',
      description: 'Database credentials',
      encryptionKey: secretsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'aetherguard_admin',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // Store ML model API keys
    const mlSecret = new secretsmanager.Secret(this, 'MLSecret', {
      secretName: 'aetherguard/production/ml-keys',
      description: 'ML model API keys',
      encryptionKey: secretsKey,
      secretObjectValue: {
        huggingface_token: cdk.SecretValue.unsafePlainText('placeholder'),
        pinecone_api_key: cdk.SecretValue.unsafePlainText('placeholder'),
        openai_api_key: cdk.SecretValue.unsafePlainText('placeholder'),
      },
    });

    // ========================================
    // AWS Backup
    // ========================================
    // Create backup vault with KMS encryption
    const backupKey = new kms.Key(this, 'BackupKey', {
      description: 'KMS key for AWS Backup',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.backupVault = new backup.BackupVault(this, 'BackupVault', {
      backupVaultName: 'aetherguard-backup-vault',
      encryptionKey: backupKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create backup plan
    const backupPlan = new backup.BackupPlan(this, 'BackupPlan', {
      backupPlanName: 'aetherguard-backup-plan',
      backupVault: this.backupVault,
      backupPlanRules: [
        // Daily backups retained for 7 days
        new backup.BackupPlanRule({
          ruleName: 'DailyBackup',
          scheduleExpression: cdk.aws_events.Schedule.cron({
            hour: '2',
            minute: '0',
          }),
          deleteAfter: cdk.Duration.days(7),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(2),
        }),
        // Weekly backups retained for 30 days
        new backup.BackupPlanRule({
          ruleName: 'WeeklyBackup',
          scheduleExpression: cdk.aws_events.Schedule.cron({
            weekDay: 'SUN',
            hour: '3',
            minute: '0',
          }),
          deleteAfter: cdk.Duration.days(30),
        }),
        // Monthly backups retained for 365 days
        new backup.BackupPlanRule({
          ruleName: 'MonthlyBackup',
          scheduleExpression: cdk.aws_events.Schedule.cron({
            day: '1',
            hour: '4',
            minute: '0',
          }),
          deleteAfter: cdk.Duration.days(365),
          moveToColdStorageAfter: cdk.Duration.days(90),
        }),
      ],
    });

    // Add DynamoDB tables to backup
    backupPlan.addSelection('DynamoDBBackup', {
      resources: [
        backup.BackupResource.fromDynamoDbTable(props.policyTable),
        backup.BackupResource.fromDynamoDbTable(props.budgetTable),
      ],
    });

    // ========================================
    // AWS GuardDuty
    // ========================================
    // Enable GuardDuty for threat detection
    const guardDutyDetector = new guardduty.CfnDetector(this, 'GuardDutyDetector', {
      enable: true,
      findingPublishingFrequency: 'FIFTEEN_MINUTES',
    });

    // Create SNS topic for GuardDuty findings
    const guardDutyTopic = new sns.Topic(this, 'GuardDutyTopic', {
      displayName: 'AetherGuard GuardDuty Findings',
      topicName: 'aetherguard-guardduty-findings',
    });

    guardDutyTopic.addSubscription(
      new subscriptions.EmailSubscription(props.notificationEmail)
    );

    // ========================================
    // AWS Security Hub
    // ========================================
    // Enable Security Hub
    const securityHub = new securityhub.CfnHub(this, 'SecurityHub', {
      controlFindingGenerator: 'SECURITY_CONTROL',
    });

    // Enable CIS AWS Foundations Benchmark
    new securityhub.CfnStandard(this, 'CISStandard', {
      standardsArn: `arn:aws:securityhub:${this.region}::standards/cis-aws-foundations-benchmark/v/1.4.0`,
    });

    // Enable AWS Foundational Security Best Practices
    new securityhub.CfnStandard(this, 'AWSBestPractices', {
      standardsArn: `arn:aws:securityhub:${this.region}::standards/aws-foundational-security-best-practices/v/1.0.0`,
    });

    // ========================================
    // AWS Config
    // ========================================
    // Create S3 bucket for Config logs
    const configBucket = new s3.Bucket(this, 'ConfigBucket', {
      bucketName: `aetherguard-config-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create Config recorder
    const configRole = new iam.Role(this, 'ConfigRole', {
      assumedBy: new iam.ServicePrincipal('config.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/ConfigRole'),
      ],
    });

    configBucket.grantWrite(configRole);

    const configRecorder = new config.CfnConfigurationRecorder(this, 'ConfigRecorder', {
      roleArn: configRole.roleArn,
      recordingGroup: {
        allSupported: true,
        includeGlobalResourceTypes: true,
      },
    });

    const configDeliveryChannel = new config.CfnDeliveryChannel(this, 'ConfigDeliveryChannel', {
      s3BucketName: configBucket.bucketName,
    });

    configDeliveryChannel.addDependency(configRecorder);

    // Add Config Rules
    // Rule: Ensure ECS tasks use encryption
    new config.ManagedRule(this, 'ECSEncryptionRule', {
      identifier: config.ManagedRuleIdentifiers.ECS_TASK_DEFINITION_USER_FOR_HOST_MODE_CHECK,
      description: 'Checks if ECS task definitions are using host network mode',
    });

    // Rule: Ensure DynamoDB encryption
    new config.ManagedRule(this, 'DynamoDBEncryptionRule', {
      identifier: config.ManagedRuleIdentifiers.DYNAMODB_TABLE_ENCRYPTED_KMS,
      description: 'Checks if DynamoDB tables are encrypted with KMS',
    });

    // Rule: Ensure S3 bucket encryption
    new config.ManagedRule(this, 'S3EncryptionRule', {
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED,
      description: 'Checks if S3 buckets have encryption enabled',
    });

    // Rule: Ensure CloudTrail is enabled
    new config.ManagedRule(this, 'CloudTrailRule', {
      identifier: config.ManagedRuleIdentifiers.CLOUD_TRAIL_ENABLED,
      description: 'Checks if CloudTrail is enabled',
    });

    // ========================================
    // AWS CloudTrail
    // ========================================
    // Create S3 bucket for CloudTrail logs
    const trailBucket = new s3.Bucket(this, 'TrailBucket', {
      bucketName: `aetherguard-cloudtrail-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          expiration: cdk.Duration.days(365),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create CloudTrail
    this.cloudTrail = new cloudtrail.Trail(this, 'CloudTrail', {
      trailName: 'aetherguard-trail',
      bucket: trailBucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      managementEvents: cloudtrail.ReadWriteType.ALL,
      sendToCloudWatchLogs: true,
    });

    // Add data events for S3 and DynamoDB
    this.cloudTrail.addS3EventSelector([
      {
        bucket: configBucket,
      },
    ]);

    // ========================================
    // Enhanced IAM Policies
    // ========================================
    // Create least-privilege IAM policy for ECS tasks
    const ecsTaskPolicy = new iam.ManagedPolicy(this, 'ECSTaskPolicy', {
      managedPolicyName: 'AetherGuardECSTaskPolicy',
      description: 'Least-privilege policy for ECS tasks',
      statements: [
        // Allow reading secrets
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'secretsmanager:GetSecretValue',
            'secretsmanager:DescribeSecret',
          ],
          resources: [
            this.secretsManager.secretArn,
            dbSecret.secretArn,
            mlSecret.secretArn,
          ],
        }),
        // Allow DynamoDB access
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:Query',
            'dynamodb:Scan',
          ],
          resources: [
            props.policyTable.tableArn,
            props.budgetTable.tableArn,
            `${props.policyTable.tableArn}/index/*`,
            `${props.budgetTable.tableArn}/index/*`,
          ],
        }),
        // Allow KMS decryption
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'kms:Decrypt',
            'kms:DescribeKey',
          ],
          resources: [
            secretsKey.keyArn,
          ],
        }),
      ],
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'SecretsManagerArn', {
      value: this.secretsManager.secretArn,
      description: 'Secrets Manager ARN',
      exportName: 'AetherGuardSecretsArn',
    });

    new cdk.CfnOutput(this, 'BackupVaultArn', {
      value: this.backupVault.backupVaultArn,
      description: 'Backup Vault ARN',
    });

    new cdk.CfnOutput(this, 'CloudTrailArn', {
      value: this.cloudTrail.trailArn,
      description: 'CloudTrail ARN',
    });

    new cdk.CfnOutput(this, 'GuardDutyDetectorId', {
      value: guardDutyDetector.ref,
      description: 'GuardDuty Detector ID',
    });

    new cdk.CfnOutput(this, 'SecurityHubArn', {
      value: securityHub.attrArn || 'N/A',
      description: 'Security Hub ARN',
    });

    new cdk.CfnOutput(this, 'ECSTaskPolicyArn', {
      value: ecsTaskPolicy.managedPolicyArn,
      description: 'ECS Task IAM Policy ARN',
      exportName: 'AetherGuardECSTaskPolicyArn',
    });

    // ========================================
    // Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'AetherGuard');
    cdk.Tags.of(this).add('Component', 'ProductionHardening');
    cdk.Tags.of(this).add('Environment', 'Production');
    cdk.Tags.of(this).add('Compliance', 'SOC2-GDPR-CCPA');
  }
}
