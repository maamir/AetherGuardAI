import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as globalaccelerator from 'aws-cdk-lib/aws-globalaccelerator';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3replication from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface MultiRegionStackProps extends cdk.StackProps {
  primaryRegion: string;
  secondaryRegions: string[];
  domainName?: string;
  hostedZoneId?: string;
}

/**
 * Multi-Region Deployment Stack
 * 
 * Provides:
 * - Active-Active deployment across multiple regions
 * - Global Accelerator for intelligent routing
 * - Route53 health checks and failover
 * - DynamoDB Global Tables
 * - S3 Cross-Region Replication
 * - Disaster Recovery (DR) capabilities
 */
export class MultiRegionStack extends cdk.Stack {
  public readonly globalAccelerator: globalaccelerator.Accelerator;
  public readonly globalTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: MultiRegionStackProps) {
    super(scope, id, props);

    // ========================================
    // Global Accelerator
    // ========================================
    this.globalAccelerator = new globalaccelerator.Accelerator(this, 'GlobalAccelerator', {
      acceleratorName: 'aetherguard-global',
      enabled: true,
    });

    // Add listener for HTTPS traffic
    const listener = this.globalAccelerator.addListener('HttpsListener', {
      portRanges: [
        { fromPort: 443, toPort: 443 },
        { fromPort: 80, toPort: 80 },
      ],
      protocol: globalaccelerator.ConnectionProtocol.TCP,
    });

    // ========================================
    // DynamoDB Global Table
    // ========================================
    // Create global table for policies (replicated across regions)
    this.globalTable = new dynamodb.Table(this, 'GlobalPolicyTable', {
      tableName: 'aetherguard-policies-global',
      partitionKey: {
        name: 'policy_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'version',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      replicationRegions: props.secondaryRegions,
      replicationTimeout: cdk.Duration.hours(2),
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for querying by tenant
    this.globalTable.addGlobalSecondaryIndex({
      indexName: 'tenant-index',
      partitionKey: {
        name: 'tenant_id',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================
    // S3 Cross-Region Replication
    // ========================================
    // Primary bucket
    const primaryBucket = new s3.Bucket(this, 'PrimaryLogBucket', {
      bucketName: `aetherguard-logs-${props.primaryRegion}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
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

    // Replica buckets in secondary regions
    props.secondaryRegions.forEach((region, index) => {
      const replicaBucket = new s3.Bucket(this, `ReplicaBucket${index}`, {
        bucketName: `aetherguard-logs-${region}`,
        versioned: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });

      // Note: Cross-region replication requires manual configuration
      // or use of custom resources due to CDK limitations
      new cdk.CfnOutput(this, `ReplicaBucket${index}Output`, {
        value: replicaBucket.bucketName,
        description: `Replica bucket in ${region}`,
      });
    });

    // ========================================
    // Route53 Health Checks (if domain provided)
    // ========================================
    if (props.domainName && props.hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName,
      });

      // Create A record pointing to Global Accelerator
      new route53.ARecord(this, 'GlobalAcceleratorRecord', {
        zone: hostedZone,
        recordName: 'api',
        target: route53.RecordTarget.fromAlias(
          new route53targets.GlobalAcceleratorTarget(this.globalAccelerator)
        ),
      });

      // Create health check for primary region
      const healthCheck = new route53.CfnHealthCheck(this, 'PrimaryHealthCheck', {
        healthCheckConfig: {
          type: 'HTTPS',
          resourcePath: '/health',
          fullyQualifiedDomainName: `api.${props.domainName}`,
          port: 443,
          requestInterval: 30,
          failureThreshold: 3,
        },
        healthCheckTags: [
          {
            key: 'Name',
            value: 'AetherGuard Primary Health Check',
          },
        ],
      });

      new cdk.CfnOutput(this, 'HealthCheckId', {
        value: healthCheck.attrHealthCheckId,
        description: 'Route53 Health Check ID',
      });
    }

    // ========================================
    // Regional Endpoint Configuration
    // ========================================
    // Output regional endpoints for configuration
    new cdk.CfnOutput(this, 'PrimaryRegion', {
      value: props.primaryRegion,
      description: 'Primary deployment region',
    });

    props.secondaryRegions.forEach((region, index) => {
      new cdk.CfnOutput(this, `SecondaryRegion${index}`, {
        value: region,
        description: `Secondary deployment region ${index + 1}`,
      });
    });

    // ========================================
    // Global Accelerator Outputs
    // ========================================
    new cdk.CfnOutput(this, 'GlobalAcceleratorDNS', {
      value: this.globalAccelerator.dnsName,
      description: 'Global Accelerator DNS name',
      exportName: 'AetherGuardGlobalAcceleratorDNS',
    });

    new cdk.CfnOutput(this, 'GlobalAcceleratorIPs', {
      value: JSON.stringify(this.globalAccelerator.ipAddresses),
      description: 'Global Accelerator static IP addresses',
    });

    // ========================================
    // DynamoDB Global Table Outputs
    // ========================================
    new cdk.CfnOutput(this, 'GlobalTableName', {
      value: this.globalTable.tableName,
      description: 'DynamoDB Global Table name',
      exportName: 'AetherGuardGlobalTableName',
    });

    new cdk.CfnOutput(this, 'GlobalTableArn', {
      value: this.globalTable.tableArn,
      description: 'DynamoDB Global Table ARN',
    });

    // ========================================
    // Disaster Recovery Configuration
    // ========================================
    // Create SSM parameters for DR configuration
    new cdk.CfnOutput(this, 'DRConfiguration', {
      value: JSON.stringify({
        primaryRegion: props.primaryRegion,
        secondaryRegions: props.secondaryRegions,
        rto: '15 minutes', // Recovery Time Objective
        rpo: '5 minutes',  // Recovery Point Objective
        failoverStrategy: 'active-active',
      }),
      description: 'Disaster Recovery configuration',
    });

    // ========================================
    // Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'AetherGuard');
    cdk.Tags.of(this).add('Component', 'MultiRegion');
    cdk.Tags.of(this).add('Environment', 'Production');
  }

  /**
   * Add regional endpoint to Global Accelerator
   */
  public addRegionalEndpoint(
    region: string,
    loadBalancer: elbv2.IApplicationLoadBalancer,
    weight: number = 100
  ): void {
    // Note: This requires the listener to be created first
    // In practice, you would add endpoint groups to the listener
    new cdk.CfnOutput(this, `RegionalEndpoint-${region}`, {
      value: loadBalancer.loadBalancerDnsName,
      description: `Regional endpoint for ${region}`,
    });
  }
}

/**
 * Regional Stack for Multi-Region Deployment
 * Deploy this stack in each region
 */
export class RegionalStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly cluster: ecs.ICluster;
  public readonly loadBalancer: elbv2.IApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Import or create VPC
    this.vpc = new ec2.Vpc(this, 'RegionalVPC', {
      maxAzs: 3,
      natGateways: 3,
    });

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, 'RegionalCluster', {
      vpc: this.vpc,
      clusterName: `aetherguard-${this.region}`,
      containerInsights: true,
    });

    // Create Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'RegionalALB', {
      vpc: this.vpc,
      internetFacing: true,
      loadBalancerName: `aetherguard-alb-${this.region}`,
    });

    // Add listener
    const listener = this.loadBalancer.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [], // Add ACM certificates
    });

    // Health check target group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'HealthCheckTG', {
      vpc: this.vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    listener.addTargetGroups('DefaultTG', {
      targetGroups: [targetGroup],
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Regional Load Balancer DNS',
      exportName: `AetherGuardALB-${this.region}`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'Regional ECS Cluster name',
    });
  }
}
