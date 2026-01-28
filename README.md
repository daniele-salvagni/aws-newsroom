# AWS Newsroom

A serverless, AWS-native platform for collecting AWS news in one place, where
team members can read, rate, comment on, and organize articles using
user-defined tags.

![Demo](docs/assets/demo.gif)

## Why

This project aims to bring a single, shared view of AWS news to a team,
especially during busy periods like the re:Invent season. Different
announcements matter to different teams or projects, and team members often have
insights worth capturing and sharing.

By deploying your own instance on your team's AWS infrastructure, you maintain
full control and ownership of your data and discussions.

## Project Status

⚠️ In active development. While the core features are implemented and
functional, expect limitations or manual steps for version upgrades.

## Architecture

Fully serverless application running on: Amazon API Gateway, AWS Lambda
Functions, Amazon Aurora DSQL, AWS Step Functions, Amazon Cognito, Amazon S3,
Amazon EventBridge. (no diagrams yet)

## Deployment

### Prerequisites

- AWS CLI
- AWS SAM CLI
- Node.js (see `.node-version`)

### Environment Variables

| Variable               | Required | Description                                              |
| ---------------------- | -------- | -------------------------------------------------------- |
| `STACK_NAME`           | Yes      | CloudFormation stack name                                |
| `ENVIRONMENT`          | Yes      | Environment identifier (e.g., `prd`, `hlx`)              |
| `ALLOWED_EMAIL_DOMAIN` | No       | Email domain for signup (default: `example.com`)         |
| `AWS_REGION`           | No       | AWS region (default: `eu-central-1`)                     |
| `DOMAIN_NAME`          | No       | Custom domain name                                       |
| `CERTIFICATE_ARN`      | No\*     | ACM certificate ARN (\*required if `DOMAIN_NAME` is set) |
| `HOSTED_ZONE_ID`       | No       | Route 53 hosted zone ID for DNS                          |
| `BRANDING_LOGO_URL`    | No       | Custom logo URL                                          |
| `BRANDING_LOGO_LINK`   | No       | Logo click-through URL                                   |

### Deploy

```bash
STACK_NAME=aws-newsroom-prd \
ENVIRONMENT=prd \
ALLOWED_EMAIL_DOMAIN=yourcompany.com \
./deploy.sh
```

With custom domain:

```bash
STACK_NAME=aws-newsroom-prd \
ENVIRONMENT=prd \
ALLOWED_EMAIL_DOMAIN=yourcompany.com \
DOMAIN_NAME=newsroom.yourcompany.com \
CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789:certificate/xxx \
HOSTED_ZONE_ID=Z0123456789 \
./deploy.sh
```

### Database Setup (first-time only)

```bash
export AURORA_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name aws-newsroom-prd \
  --region eu-central-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`AuroraEndpoint`].OutputValue' \
  --output text)

export PGPASSWORD=$(aws dsql generate-db-connect-admin-auth-token \
  --hostname $AURORA_ENDPOINT \
  --region eu-central-1)

psql -h $AURORA_ENDPOINT -U admin -d postgres -f database/init.sql
```

### Data Ingestion

Data is ingested hourly (disabled by default). Enable via
`PeriodicIngestionRule` in AWS Console or SAM template.

Manual trigger: invoke the Step Functions state machine with:

```json
{ "daysBack": 7 }
```

### CI/CD (GitHub Actions)

For automated deployments, create a workflow using the OIDC role from
`infra/github-oidc-role.yaml` and configure GitHub Environments with the
variables above.

## Development

To set up the development environment, run the following commands:

```bash
npm install
```

See `scripts` section in `package.json` for available commands.

## License

This project is licensed under the Apache-2.0 License. See the LICENSE file for
details.
