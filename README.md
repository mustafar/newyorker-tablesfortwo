# Tables for Two Notifier 🍝 ![](https://www.newyorker.com/favicon.ico)

Get restaurants featured in the New Yorker's [Tables for Two](https://github.com/mustafar/newyorker-tablesfortwo) section in your email. Save them in your Google Maps Saved Places using the maps link in the email.

## Development

Install and configure [serverless](https://serverless.com/)

Install the project: `npm install`

Run tests: `npm test`

Make sure linter's good: `npm run lint`

## Deployment

Get a google maps api key and create an SNS topic to send restaurants to.

Create an `env.yml` file to store secrets
```
prod:
  APP_NAME: tablesfortwo-notifier
  GOOGLE_API_KEY: <google_api_key>
  AWS_SNS_ARN: <sns_arn>
  AWS_SNS_ALARMS_ARN: <alarm_sns_arn>
```

Configure serverless options in [serverless.yml](https://github.com/mustafar/tablesfortwo-notifier/blob/master/serverless.yml).

Deploy using serverless: `serverless deploy`

To prune old versions of the function: `serverless prune -n 1`  
Remember to delete old zip files in S3
