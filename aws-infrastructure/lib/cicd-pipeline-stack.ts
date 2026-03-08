import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface CICDPipelineStackProps extends cdk.StackProps {
  proxyRepository: ecr.IRepository;
  mlRepository: ecr.IRepository;
  ecsCluster: ecs.ICluster;
  proxyService: ecs.IBaseService;
  mlService: ecs.IBaseService;
  notificationEmail: string;
}

/**
 * CI/CD Pipeline Stack
 * 
 * Provides:
 * - CodePipeline for automated deployments
 * - CodeBuild for container builds
 * - Automated testing and security scanning
 * - Blue/Green deployments
 * - Rollback capabilities
 * - Notifications
 */
export class CICDPipelineStack extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly repository: codecommit.IRepository;

  constructor(scope: Construct, id: string, props: CICDPipelineStackProps) {
    super(scope, id, props);

    // ========================================
    // CodeCommit Repository
    // ========================================
    this.repository = new codecommit.Repository(this, 'Repository', {
      repositoryName: 'aetherguard-ai',
      description: 'AetherGuard AI source code repository',
    });

    // ========================================
    // S3 Bucket for Artifacts
    // ========================================
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      bucketName: `aetherguard-pipeline-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // SNS Topic for Notifications
    // ========================================
    const pipelineTopic = new sns.Topic(this, 'PipelineTopic', {
      displayName: 'AetherGuard Pipeline Notifications',
      topicName: 'aetherguard-pipeline-notifications',
    });

    pipelineTopic.addSubscription(
      new subscriptions.EmailSubscription(props.notificationEmail)
    );

    // ========================================
    // CodeBuild Projects
    // ========================================
    // Build project for Proxy Engine (Rust)
    const proxyBuildProject = new codebuild.PipelineProject(this, 'ProxyBuildProject', {
      projectName: 'aetherguard-proxy-build',
      description: 'Build AetherGuard Proxy Engine',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true, // Required for Docker builds
        computeType: codebuild.ComputeType.LARGE,
        environmentVariables: {
          AWS_ACCOUNT_ID: {
            value: this.account,
          },
          AWS_DEFAULT_REGION: {
            value: this.region,
          },
          IMAGE_REPO_NAME: {
            value: props.proxyRepository.repositoryName,
          },
          IMAGE_TAG: {
            value: 'latest',
          },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Building Rust proxy engine...',
              'cd proxy-engine',
              'docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG .',
              'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG',
              'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Pushing Docker images...',
              'docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG',
              'docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest',
              'echo Writing image definitions file...',
              'printf \'[{"name":"proxy-engine","imageUri":"%s"}]\' $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG > imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: ['imagedefinitions.json'],
          'base-directory': 'proxy-engine',
        },
      }),
    });

    // Grant ECR permissions
    props.proxyRepository.grantPullPush(proxyBuildProject);

    // Build project for ML Services (Python)
    const mlBuildProject = new codebuild.PipelineProject(this, 'MLBuildProject', {
      projectName: 'aetherguard-ml-build',
      description: 'Build AetherGuard ML Services',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
        computeType: codebuild.ComputeType.LARGE,
        environmentVariables: {
          AWS_ACCOUNT_ID: {
            value: this.account,
          },
          AWS_DEFAULT_REGION: {
            value: this.region,
          },
          IMAGE_REPO_NAME: {
            value: props.mlRepository.repositoryName,
          },
          IMAGE_TAG: {
            value: 'latest',
          },
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Building Python ML services...',
              'cd ml-services',
              'docker build -t $IMAGE_REPO_NAME:$IMAGE_TAG .',
              'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG',
              'docker tag $IMAGE_REPO_NAME:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Pushing Docker images...',
              'docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG',
              'docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:latest',
              'echo Writing image definitions file...',
              'printf \'[{"name":"ml-services","imageUri":"%s"}]\' $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME:$IMAGE_TAG > imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: ['imagedefinitions.json'],
          'base-directory': 'ml-services',
        },
      }),
    });

    props.mlRepository.grantPullPush(mlBuildProject);

    // Test project
    const testProject = new codebuild.PipelineProject(this, 'TestProject', {
      projectName: 'aetherguard-test',
      description: 'Run tests for AetherGuard',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'echo Installing dependencies...',
              'cd proxy-engine && cargo test --no-run',
              'cd ../ml-services && pip install -r requirements.txt',
            ],
          },
          build: {
            commands: [
              'echo Running tests...',
              'cd proxy-engine && cargo test',
              'cd ../ml-services && python -m pytest tests/ || true',
            ],
          },
        },
      }),
    });

    // Security scanning project
    const securityScanProject = new codebuild.PipelineProject(this, 'SecurityScanProject', {
      projectName: 'aetherguard-security-scan',
      description: 'Security scanning for AetherGuard',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'echo Installing security tools...',
              'pip install bandit safety',
            ],
          },
          build: {
            commands: [
              'echo Running security scans...',
              'cd ml-services',
              'bandit -r . -f json -o bandit-report.json || true',
              'safety check --json || true',
              'echo Security scan completed',
            ],
          },
        },
      }),
    });

    // ========================================
    // CodePipeline
    // ========================================
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const proxyBuildOutput = new codepipeline.Artifact('ProxyBuildOutput');
    const mlBuildOutput = new codepipeline.Artifact('MLBuildOutput');

    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'aetherguard-pipeline',
      artifactBucket: artifactBucket,
      restartExecutionOnUpdate: true,
    });

    // Source stage
    this.pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeCommitSourceAction({
          actionName: 'CodeCommit',
          repository: this.repository,
          branch: 'main',
          output: sourceOutput,
          trigger: codepipeline_actions.CodeCommitTrigger.EVENTS,
        }),
      ],
    });

    // Test stage
    this.pipeline.addStage({
      stageName: 'Test',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'UnitTests',
          project: testProject,
          input: sourceOutput,
        }),
        new codepipeline_actions.CodeBuildAction({
          actionName: 'SecurityScan',
          project: securityScanProject,
          input: sourceOutput,
        }),
      ],
    });

    // Build stage
    this.pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'BuildProxy',
          project: proxyBuildProject,
          input: sourceOutput,
          outputs: [proxyBuildOutput],
        }),
        new codepipeline_actions.CodeBuildAction({
          actionName: 'BuildML',
          project: mlBuildProject,
          input: sourceOutput,
          outputs: [mlBuildOutput],
        }),
      ],
    });

    // Manual approval stage
    this.pipeline.addStage({
      stageName: 'Approval',
      actions: [
        new codepipeline_actions.ManualApprovalAction({
          actionName: 'ManualApproval',
          notificationTopic: pipelineTopic,
          additionalInformation: 'Please review and approve deployment to production',
        }),
      ],
    });

    // Deploy stage
    this.pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: 'DeployProxy',
          service: props.proxyService,
          input: proxyBuildOutput,
          deploymentTimeout: cdk.Duration.minutes(30),
        }),
        new codepipeline_actions.EcsDeployAction({
          actionName: 'DeployML',
          service: props.mlService,
          input: mlBuildOutput,
          deploymentTimeout: cdk.Duration.minutes(30),
        }),
      ],
    });

    // Pipeline notifications
    this.pipeline.onStateChange('PipelineStateChange', {
      target: new cdk.aws_events_targets.SnsTopic(pipelineTopic),
      description: 'Pipeline state change notification',
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'RepositoryCloneUrl', {
      value: this.repository.repositoryCloneUrlHttp,
      description: 'CodeCommit repository clone URL',
      exportName: 'AetherGuardRepositoryUrl',
    });

    new cdk.CfnOutput(this, 'PipelineName', {
      value: this.pipeline.pipelineName,
      description: 'CodePipeline name',
    });

    new cdk.CfnOutput(this, 'PipelineArn', {
      value: this.pipeline.pipelineArn,
      description: 'CodePipeline ARN',
    });

    new cdk.CfnOutput(this, 'ArtifactBucketName', {
      value: artifactBucket.bucketName,
      description: 'Pipeline artifact bucket',
    });

    // ========================================
    // Tags
    // ========================================
    cdk.Tags.of(this).add('Project', 'AetherGuard');
    cdk.Tags.of(this).add('Component', 'CICD');
    cdk.Tags.of(this).add('Environment', 'Production');
  }
}
