import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  cluster: ecs.Cluster;
  loadBalancer: elbv2.ApplicationLoadBalancer;
}

export class AetherGuardMonitoringStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'AetherGuard Alarms',
      topicName: 'AetherGuardAlarms',
    });

    // Add email subscription (configure via parameter)
    const emailAddress = new cdk.CfnParameter(this, 'AlarmEmail', {
      type: 'String',
      description: 'Email address for alarm notifications',
      default: 'ops@example.com',
    });

    this.alarmTopic.addSubscription(
      new subscriptions.EmailSubscription(emailAddress.valueAsString)
    );

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: 'AetherGuard-Production',
    });

    // ===== ECS Cluster Metrics =====
    const clusterCpuMetric = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'CPUUtilization',
      dimensionsMap: {
        ClusterName: props.cluster.clusterName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const clusterMemoryMetric = new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName: 'MemoryUtilization',
      dimensionsMap: {
        ClusterName: props.cluster.clusterName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // ===== ALB Metrics =====
    const albRequestCountMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'RequestCount',
      dimensionsMap: {
        LoadBalancer: props.loadBalancer.loadBalancerFullName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    });

    const albTargetResponseTimeMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'TargetResponseTime',
      dimensionsMap: {
        LoadBalancer: props.loadBalancer.loadBalancerFullName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(1),
    });

    const alb5xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_Target_5XX_Count',
      dimensionsMap: {
        LoadBalancer: props.loadBalancer.loadBalancerFullName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    });

    const alb4xxMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_Target_4XX_Count',
      dimensionsMap: {
        LoadBalancer: props.loadBalancer.loadBalancerFullName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
    });

    // ===== Custom Application Metrics =====
    const injectionDetectionMetric = new cloudwatch.Metric({
      namespace: 'AetherGuard',
      metricName: 'InjectionDetections',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const toxicityDetectionMetric = new cloudwatch.Metric({
      namespace: 'AetherGuard',
      metricName: 'ToxicityDetections',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const piiDetectionMetric = new cloudwatch.Metric({
      namespace: 'AetherGuard',
      metricName: 'PIIDetections',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const requestLatencyMetric = new cloudwatch.Metric({
      namespace: 'AetherGuard',
      metricName: 'RequestLatency',
      statistic: 'Average',
      period: cdk.Duration.minutes(1),
    });

    // ===== Dashboard Widgets =====

    // Row 1: Overview
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# AetherGuard AI - Production Dashboard\n\nReal-time monitoring of AI firewall operations',
        width: 24,
        height: 2,
      })
    );

    // Row 2: Request Metrics
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Request Rate',
        left: [albRequestCountMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Response Time (ms)',
        left: [albTargetResponseTimeMetric],
        width: 12,
        height: 6,
      })
    );

    // Row 3: Error Rates
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'HTTP 5xx Errors',
        left: [alb5xxMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'HTTP 4xx Errors',
        left: [alb4xxMetric],
        width: 12,
        height: 6,
      })
    );

    // Row 4: Resource Utilization
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ECS CPU Utilization (%)',
        left: [clusterCpuMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Memory Utilization (%)',
        left: [clusterMemoryMetric],
        width: 12,
        height: 6,
      })
    );

    // Row 5: Security Detections
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Security Detections',
        left: [injectionDetectionMetric, toxicityDetectionMetric, piiDetectionMetric],
        width: 18,
        height: 6,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Avg Latency (ms)',
        metrics: [requestLatencyMetric],
        width: 6,
        height: 6,
      })
    );

    // ===== Alarms =====

    // High CPU Alarm
    const highCpuAlarm = new cloudwatch.Alarm(this, 'HighCPUAlarm', {
      metric: clusterCpuMetric,
      threshold: 80,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ECS cluster CPU utilization is above 80%',
      alarmName: 'AetherGuard-HighCPU',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    highCpuAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // High Memory Alarm
    const highMemoryAlarm = new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
      metric: clusterMemoryMetric,
      threshold: 85,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'ECS cluster memory utilization is above 85%',
      alarmName: 'AetherGuard-HighMemory',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    highMemoryAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // High 5xx Error Rate Alarm
    const high5xxAlarm = new cloudwatch.Alarm(this, 'High5xxAlarm', {
      metric: alb5xxMetric,
      threshold: 10,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'High rate of 5xx errors detected',
      alarmName: 'AetherGuard-High5xxErrors',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    high5xxAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // High Response Time Alarm
    const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
      metric: albTargetResponseTimeMetric,
      threshold: 1, // 1 second
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Response time is above 1 second',
      alarmName: 'AetherGuard-HighLatency',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    highLatencyAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // High Injection Detection Rate Alarm
    const highInjectionAlarm = new cloudwatch.Alarm(this, 'HighInjectionAlarm', {
      metric: injectionDetectionMetric,
      threshold: 100,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'High rate of injection attempts detected',
      alarmName: 'AetherGuard-HighInjectionRate',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    highInjectionAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // Composite Alarm for Critical Issues
    const criticalAlarm = new cloudwatch.CompositeAlarm(this, 'CriticalAlarm', {
      compositeAlarmName: 'AetherGuard-Critical',
      alarmDescription: 'Multiple critical issues detected',
      alarmRule: cloudwatch.AlarmRule.anyOf(
        cloudwatch.AlarmRule.fromAlarm(highCpuAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(highMemoryAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(high5xxAlarm, cloudwatch.AlarmState.ALARM)
      ),
    });
    criticalAlarm.addAlarmAction(new actions.SnsAction(this.alarmTopic));

    // ===== Log Insights Queries =====
    
    // Create saved queries for common investigations
    new cdk.aws_logs.QueryDefinition(this, 'InjectionAttemptsQuery', {
      queryDefinitionName: 'AetherGuard-InjectionAttempts',
      queryString: new cdk.aws_logs.QueryString({
        fields: ['@timestamp', '@message'],
        filter: '@message like /injection_detected/',
        sort: '@timestamp desc',
        limit: 100,
      }),
    });

    new cdk.aws_logs.QueryDefinition(this, 'ErrorsQuery', {
      queryDefinitionName: 'AetherGuard-Errors',
      queryString: new cdk.aws_logs.QueryString({
        fields: ['@timestamp', '@message'],
        filter: '@message like /ERROR/',
        stats: 'count() by bin(5m)',
      }),
    });

    new cdk.aws_logs.QueryDefinition(this, 'LatencyQuery', {
      queryDefinitionName: 'AetherGuard-Latency',
      queryString: new cdk.aws_logs.QueryString({
        fields: ['@timestamp', 'latency_ms'],
        filter: 'latency_ms > 100',
        stats: 'avg(latency_ms), max(latency_ms), min(latency_ms) by bin(1m)',
      }),
    });

    // Outputs
    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: 'AetherGuardDashboardURL',
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
      exportName: 'AetherGuardAlarmTopicArn',
    });
  }
}
