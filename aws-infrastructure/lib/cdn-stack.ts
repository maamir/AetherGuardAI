import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as globalaccelerator from 'aws-cdk-lib/aws-globalaccelerator';
import * as ga_endpoints from 'aws-cdk-lib/aws-globalaccelerator-endpoints';
import { Construct } from 'constructs';

export interface CdnStackProps extends cdk.StackProps {
  loadBalancer: elbv2.ApplicationLoadBalancer;
  domainName?: string;
  hostedZoneId?: string;
}

export class AetherGuardCdnStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly accelerator: globalaccelerator.Accelerator;
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: CdnStackProps) {
    super(scope, id, props);

    // ===== WAF Web ACL =====
    this.webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AetherGuardWAF',
      },
      rules: [
        // Rate limiting rule
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
        // AWS Managed Rules - Core Rule Set
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
          },
        },
        // AWS Managed Rules - Known Bad Inputs
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
        // AWS Managed Rules - SQL Injection
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 4,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesSQLiRuleSet',
          },
        },
        // Geo-blocking rule (example: block specific countries)
        {
          name: 'GeoBlockingRule',
          priority: 5,
          statement: {
            geoMatchStatement: {
              countryCodes: ['CN', 'RU', 'KP'], // Example: block China, Russia, North Korea
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'GeoBlockingRule',
          },
        },
      ],
    });

    // ===== CloudFront Distribution =====
    
    // Cache Policy
    const cachePolicy = new cloudfront.CachePolicy(this, 'CachePolicy', {
      cachePolicyName: 'AetherGuardCachePolicy',
      comment: 'Cache policy for AetherGuard API',
      defaultTtl: cdk.Duration.seconds(0), // No caching by default for API
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(1),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Authorization',
        'Content-Type',
        'X-API-Key'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Origin Request Policy
    const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'OriginRequestPolicy', {
      originRequestPolicyName: 'AetherGuardOriginRequestPolicy',
      comment: 'Forward all headers and query strings',
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.all(),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
    });

    // Response Headers Policy
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'ResponseHeadersPolicy', {
      responseHeadersPolicyName: 'AetherGuardSecurityHeaders',
      comment: 'Security headers for AetherGuard',
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.seconds(31536000),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true,
        },
        xssProtection: {
          protection: true,
          modeBlock: true,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'X-Powered-By',
            value: 'AetherGuard AI',
            override: true,
          },
        ],
      },
    });

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'AetherGuard AI CDN',
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(props.loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          httpsPort: 443,
          originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
          readTimeout: cdk.Duration.seconds(60),
          keepaliveTimeout: cdk.Duration.seconds(5),
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        cachePolicy: cachePolicy,
        originRequestPolicy: originRequestPolicy,
        responseHeadersPolicy: responseHeadersPolicy,
        compress: true,
      },
      enableLogging: true,
      logIncludesCookies: true,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      webAclId: this.webAcl.attrArn,
    });

    // ===== Global Accelerator =====
    this.accelerator = new globalaccelerator.Accelerator(this, 'Accelerator', {
      acceleratorName: 'AetherGuardAccelerator',
      enabled: true,
    });

    // Listener
    const listener = this.accelerator.addListener('Listener', {
      listenerName: 'AetherGuardListener',
      portRanges: [
        { fromPort: 443, toPort: 443 },
        { fromPort: 80, toPort: 80 },
      ],
      protocol: globalaccelerator.ConnectionProtocol.TCP,
    });

    // Endpoint Group
    listener.addEndpointGroup('EndpointGroup', {
      endpoints: [
        new ga_endpoints.ApplicationLoadBalancerEndpoint(props.loadBalancer, {
          weight: 100,
          preserveClientIp: true,
        }),
      ],
      healthCheckInterval: cdk.Duration.seconds(30),
      healthCheckPath: '/health',
      healthCheckProtocol: globalaccelerator.HealthCheckProtocol.HTTPS,
      healthCheckPort: 443,
      thresholdCount: 3,
      trafficDialPercentage: 100,
    });

    // ===== Route53 (if domain provided) =====
    if (props.domainName && props.hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.domainName,
      });

      // CloudFront alias record
      new route53.ARecord(this, 'CloudFrontAliasRecord', {
        zone: hostedZone,
        recordName: `api.${props.domainName}`,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(this.distribution)
        ),
      });

      // Global Accelerator alias record
      new route53.ARecord(this, 'AcceleratorAliasRecord', {
        zone: hostedZone,
        recordName: `edge.${props.domainName}`,
        target: route53.RecordTarget.fromAlias(
          new targets.GlobalAcceleratorTarget(this.accelerator)
        ),
      });
    }

    // ===== Outputs =====
    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: 'AetherGuardCloudFrontDomain',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: 'AetherGuardCloudFrontId',
    });

    new cdk.CfnOutput(this, 'GlobalAcceleratorDns', {
      value: this.accelerator.dnsName,
      description: 'Global Accelerator DNS name',
      exportName: 'AetherGuardAcceleratorDns',
    });

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAcl.attrArn,
      description: 'WAF Web ACL ARN',
      exportName: 'AetherGuardWebAclArn',
    });
  }
}
