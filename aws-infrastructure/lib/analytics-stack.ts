import * as cdk from 'aws-cdk-lib';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface AnalyticsStackProps extends cdk.StackProps {
  logBucket: s3.Bucket;
  kmsKey: kms.Key;
}

export class AetherGuardAnalyticsStack extends cdk.Stack {
  public readonly logStream: kinesis.Stream;
  public readonly glueDatabase: glue.CfnDatabase;
  public readonly athenaWorkgroup: athena.CfnWorkGroup;

  constructor(scope: Construct, id: string, props: AnalyticsStackProps) {
    super(scope, id, props);

    // ===== Kinesis Data Stream =====
    this.logStream = new kinesis.Stream(this, 'LogStream', {
      streamName: 'AetherGuardLogs',
      shardCount: 2,
      retentionPeriod: cdk.Duration.hours(24),
      encryption: kinesis.StreamEncryption.KMS,
      encryptionKey: props.kmsKey,
      streamMode: kinesis.StreamMode.PROVISIONED,
    });

    // ===== S3 Bucket for Analytics Data =====
    const analyticsBucket = new s3.Bucket(this, 'AnalyticsBucket', {
      bucketName: `aetherguard-analytics-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });

    // ===== IAM Role for Firehose =====
    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
      description: 'Role for Kinesis Firehose to write to S3',
    });

    analyticsBucket.grantWrite(firehoseRole);
    props.kmsKey.grantEncryptDecrypt(firehoseRole);
    this.logStream.grantRead(firehoseRole);

    // ===== Kinesis Firehose Delivery Stream =====
    const deliveryStream = new firehose.CfnDeliveryStream(this, 'DeliveryStream', {
      deliveryStreamName: 'AetherGuardLogsToS3',
      deliveryStreamType: 'KinesisStreamAsSource',
      kinesisStreamSourceConfiguration: {
        kinesisStreamArn: this.logStream.streamArn,
        roleArn: firehoseRole.roleArn,
      },
      extendedS3DestinationConfiguration: {
        bucketArn: analyticsBucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        prefix: 'logs/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/',
        errorOutputPrefix: 'errors/',
        bufferingHints: {
          sizeInMBs: 128,
          intervalInSeconds: 300,
        },
        compressionFormat: 'GZIP',
        encryptionConfiguration: {
          kmsEncryptionConfig: {
            awskmsKeyArn: props.kmsKey.keyArn,
          },
        },
        dataFormatConversionConfiguration: {
          enabled: true,
          schemaConfiguration: {
            roleArn: firehoseRole.roleArn,
            databaseName: 'aetherguard',
            tableName: 'logs',
            region: this.region,
          },
          inputFormatConfiguration: {
            deserializer: {
              openXJsonSerDe: {},
            },
          },
          outputFormatConfiguration: {
            serializer: {
              parquetSerDe: {},
            },
          },
        },
      },
    });

    // ===== AWS Glue Database =====
    this.glueDatabase = new glue.CfnDatabase(this, 'GlueDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: 'aetherguard',
        description: 'AetherGuard AI analytics database',
      },
    });

    // ===== Glue Table for Logs =====
    const logsTable = new glue.CfnTable(this, 'LogsTable', {
      catalogId: this.account,
      databaseName: this.glueDatabase.ref,
      tableInput: {
        name: 'logs',
        description: 'AetherGuard request logs',
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          'classification': 'parquet',
          'compressionType': 'gzip',
        },
        storageDescriptor: {
          columns: [
            { name: 'timestamp', type: 'timestamp' },
            { name: 'request_id', type: 'string' },
            { name: 'user_id', type: 'string' },
            { name: 'event_type', type: 'string' },
            { name: 'latency_ms', type: 'double' },
            { name: 'status', type: 'string' },
            { name: 'detections', type: 'array<string>' },
            { name: 'blocked', type: 'boolean' },
          ],
          location: `s3://${analyticsBucket.bucketName}/logs/`,
          inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
          },
        },
        partitionKeys: [
          { name: 'year', type: 'string' },
          { name: 'month', type: 'string' },
          { name: 'day', type: 'string' },
        ],
      },
    });

    // ===== Glue Table for Detections =====
    const detectionsTable = new glue.CfnTable(this, 'DetectionsTable', {
      catalogId: this.account,
      databaseName: this.glueDatabase.ref,
      tableInput: {
        name: 'detections',
        description: 'Security detections',
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          'classification': 'parquet',
        },
        storageDescriptor: {
          columns: [
            { name: 'timestamp', type: 'timestamp' },
            { name: 'request_id', type: 'string' },
            { name: 'detection_type', type: 'string' },
            { name: 'severity', type: 'string' },
            { name: 'confidence', type: 'double' },
            { name: 'details', type: 'string' },
          ],
          location: `s3://${analyticsBucket.bucketName}/detections/`,
          inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
          },
        },
      },
    });

    // ===== Glue Crawler =====
    const crawlerRole = new iam.Role(this, 'CrawlerRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
    });

    analyticsBucket.grantRead(crawlerRole);
    props.kmsKey.grantDecrypt(crawlerRole);

    const crawler = new glue.CfnCrawler(this, 'LogsCrawler', {
      name: 'AetherGuardLogsCrawler',
      role: crawlerRole.roleArn,
      databaseName: this.glueDatabase.ref,
      targets: {
        s3Targets: [
          {
            path: `s3://${analyticsBucket.bucketName}/logs/`,
          },
        ],
      },
      schedule: {
        scheduleExpression: 'cron(0 1 * * ? *)', // Daily at 1 AM
      },
      schemaChangePolicy: {
        updateBehavior: 'UPDATE_IN_DATABASE',
        deleteBehavior: 'LOG',
      },
    });

    // ===== Athena Workgroup =====
    const athenaResultsBucket = new s3.Bucket(this, 'AthenaResultsBucket', {
      bucketName: `aetherguard-athena-results-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          id: 'DeleteOldResults',
          expiration: cdk.Duration.days(30),
        },
      ],
    });

    this.athenaWorkgroup = new athena.CfnWorkGroup(this, 'AthenaWorkgroup', {
      name: 'AetherGuardAnalytics',
      description: 'Workgroup for AetherGuard analytics queries',
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: `s3://${athenaResultsBucket.bucketName}/`,
          encryptionConfiguration: {
            encryptionOption: 'SSE_KMS',
            kmsKey: props.kmsKey.keyArn,
          },
        },
        enforceWorkGroupConfiguration: true,
        publishCloudWatchMetricsEnabled: true,
        bytesScannedCutoffPerQuery: 1000000000000, // 1 TB
      },
    });

    // ===== Named Queries =====
    new athena.CfnNamedQuery(this, 'TopDetectionsQuery', {
      database: this.glueDatabase.ref,
      queryString: `
        SELECT detection_type, COUNT(*) as count
        FROM detections
        WHERE timestamp > current_timestamp - interval '24' hour
        GROUP BY detection_type
        ORDER BY count DESC
        LIMIT 10
      `,
      name: 'Top Detections Last 24h',
      description: 'Top 10 detection types in the last 24 hours',
      workGroup: this.athenaWorkgroup.name,
    });

    new athena.CfnNamedQuery(this, 'LatencyAnalysisQuery', {
      database: this.glueDatabase.ref,
      queryString: `
        SELECT 
          date_trunc('hour', timestamp) as hour,
          AVG(latency_ms) as avg_latency,
          APPROX_PERCENTILE(latency_ms, 0.95) as p95_latency,
          APPROX_PERCENTILE(latency_ms, 0.99) as p99_latency
        FROM logs
        WHERE timestamp > current_timestamp - interval '7' day
        GROUP BY date_trunc('hour', timestamp)
        ORDER BY hour DESC
      `,
      name: 'Latency Analysis Last 7 Days',
      description: 'Hourly latency statistics for the last 7 days',
      workGroup: this.athenaWorkgroup.name,
    });

    new athena.CfnNamedQuery(this, 'BlockedRequestsQuery', {
      database: this.glueDatabase.ref,
      queryString: `
        SELECT 
          user_id,
          COUNT(*) as blocked_count,
          ARRAY_AGG(DISTINCT event_type) as event_types
        FROM logs
        WHERE blocked = true
          AND timestamp > current_timestamp - interval '24' hour
        GROUP BY user_id
        ORDER BY blocked_count DESC
        LIMIT 20
      `,
      name: 'Top Blocked Users Last 24h',
      description: 'Users with most blocked requests in the last 24 hours',
      workGroup: this.athenaWorkgroup.name,
    });

    // ===== Outputs =====
    new cdk.CfnOutput(this, 'KinesisStreamName', {
      value: this.logStream.streamName,
      description: 'Kinesis stream name for log ingestion',
      exportName: 'AetherGuardKinesisStreamName',
    });

    new cdk.CfnOutput(this, 'AnalyticsBucketName', {
      value: analyticsBucket.bucketName,
      description: 'S3 bucket for analytics data',
      exportName: 'AetherGuardAnalyticsBucket',
    });

    new cdk.CfnOutput(this, 'GlueDatabaseName', {
      value: this.glueDatabase.ref,
      description: 'Glue database name',
      exportName: 'AetherGuardGlueDatabase',
    });

    new cdk.CfnOutput(this, 'AthenaWorkgroupName', {
      value: this.athenaWorkgroup.name!,
      description: 'Athena workgroup name',
      exportName: 'AetherGuardAthenaWorkgroup',
    });
  }
}
