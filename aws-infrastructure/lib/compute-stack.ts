import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as qldb from 'aws-cdk-lib/aws-qldb';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  kmsKey: kms.Key;
  auditTable: qldb.CfnLedger;
  policyTable: dynamodb.Table;
  logBucket: s3.Bucket;
}

export class AetherGuardComputeStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly proxyService: ecs.FargateService;
  public readonly mlService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'AetherGuardCluster', {
      clusterName: 'AetherGuardCluster',
      vpc: props.vpc,
      containerInsights: true,
    });

    // ECR Repositories
    const proxyRepo = new ecr.Repository(this, 'ProxyRepository', {
      repositoryName: 'aetherguard/proxy-engine',
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.KMS,
      encryptionKey: props.kmsKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const mlRepo = new ecr.Repository(this, 'MLRepository', {
      repositoryName: 'aetherguard/ml-services',
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.KMS,
      encryptionKey: props.kmsKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: true,
      http2Enabled: true,
      dropInvalidHeaderFields: true,
    });

    // ALB Security Group
    this.loadBalancer.connections.allowFromAnyIpv4(
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // Target Groups
    const proxyTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ProxyTargetGroup', {
      vpc: props.vpc,
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
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    const mlTargetGroup = new elbv2.ApplicationTargetGroup(this, 'MLTargetGroup', {
      vpc: props.vpc,
      port: 8001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // ALB Listener
    const listener = this.loadBalancer.addListener('Listener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Not Found',
      }),
      // TODO: Add SSL certificate
      // certificates: [certificate],
    });

    // Listener Rules
    listener.addTargetGroups('ProxyRule', {
      targetGroups: [proxyTargetGroup],
      priority: 1,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/v1/*']),
      ],
    });

    listener.addTargetGroups('MLRule', {
      targetGroups: [mlTargetGroup],
      priority: 2,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/detect/*', '/watermark/*', '/integrity/*']),
      ],
    });

    // Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant permissions
    props.kmsKey.grantDecrypt(taskExecutionRole);
    proxyRepo.grantPull(taskExecutionRole);
    mlRepo.grantPull(taskExecutionRole);

    // Task Role (for application permissions)
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Grant task role permissions
    props.kmsKey.grant(taskRole, 'kms:Decrypt', 'kms:Encrypt', 'kms:GenerateDataKey');
    props.logBucket.grantReadWrite(taskRole);
    props.policyTable.grantReadWriteData(taskRole);

    // Grant QLDB permissions
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'qldb:SendCommand',
        'qldb:PartiQLInsert',
        'qldb:PartiQLSelect',
      ],
      resources: [props.auditTable.attrArn],
    }));

    // Proxy Engine Task Definition
    const proxyTaskDef = new ecs.FargateTaskDefinition(this, 'ProxyTaskDef', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    const proxyLogGroup = new logs.LogGroup(this, 'ProxyLogGroup', {
      logGroupName: '/ecs/aetherguard/proxy',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    proxyTaskDef.addContainer('ProxyContainer', {
      image: ecs.ContainerImage.fromEcrRepository(proxyRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'proxy',
        logGroup: proxyLogGroup,
      }),
      environment: {
        RUST_LOG: 'info',
        ML_SERVICE_URL: 'http://localhost:8001',
      },
      secrets: {
        KMS_KEY_ID: ecs.Secret.fromSecretsManager(
          // TODO: Create secret for KMS key ID
        ),
      },
      portMappings: [
        {
          containerPort: 8080,
          protocol: ecs.Protocol.TCP,
        },
      ],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8080/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ML Services Task Definition
    const mlTaskDef = new ecs.FargateTaskDefinition(this, 'MLTaskDef', {
      memoryLimitMiB: 8192,
      cpu: 4096,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    const mlLogGroup = new logs.LogGroup(this, 'MLLogGroup', {
      logGroupName: '/ecs/aetherguard/ml',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    mlTaskDef.addContainer('MLContainer', {
      image: ecs.ContainerImage.fromEcrRepository(mlRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ml',
        logGroup: mlLogGroup,
      }),
      environment: {
        PYTHONUNBUFFERED: '1',
        LOG_LEVEL: 'INFO',
      },
      portMappings: [
        {
          containerPort: 8001,
          protocol: ecs.Protocol.TCP,
        },
      ],
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8001/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(120),
      },
    });

    // Proxy Service
    this.proxyService = new ecs.FargateService(this, 'ProxyService', {
      cluster: this.cluster,
      taskDefinition: proxyTaskDef,
      desiredCount: 3,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      circuitBreaker: {
        rollback: true,
      },
      enableExecuteCommand: true,
    });

    // Attach to target group
    this.proxyService.attachToApplicationTargetGroup(proxyTargetGroup);

    // Auto Scaling
    const proxyScaling = this.proxyService.autoScaleTaskCount({
      minCapacity: 3,
      maxCapacity: 20,
    });

    proxyScaling.scaleOnCpuUtilization('ProxyCPUScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    proxyScaling.scaleOnMemoryUtilization('ProxyMemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ML Service
    this.mlService = new ecs.FargateService(this, 'MLService', {
      cluster: this.cluster,
      taskDefinition: mlTaskDef,
      desiredCount: 2,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: cdk.Duration.seconds(120),
      circuitBreaker: {
        rollback: true,
      },
      enableExecuteCommand: true,
    });

    // Attach to target group
    this.mlService.attachToApplicationTargetGroup(mlTargetGroup);

    // Auto Scaling
    const mlScaling = this.mlService.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 10,
    });

    mlScaling.scaleOnCpuUtilization('MLCPUScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'Load Balancer DNS',
      exportName: 'AetherGuardLoadBalancerDNS',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: 'AetherGuardClusterName',
    });

    new cdk.CfnOutput(this, 'ProxyRepoURI', {
      value: proxyRepo.repositoryUri,
      description: 'Proxy ECR Repository URI',
      exportName: 'AetherGuardProxyRepoURI',
    });

    new cdk.CfnOutput(this, 'MLRepoURI', {
      value: mlRepo.repositoryUri,
      description: 'ML ECR Repository URI',
      exportName: 'AetherGuardMLRepoURI',
    });
  }
}
