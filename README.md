# Coaching Blog

A very basic blog built in React (using Vite).

At present, content is hardcoded and stored locally. Longer term, it is to be hosted on AWS (S3, Route53 and CloudFront via CloudFormation), using a Contentful headless CMS for retrieving the content.

## Status

This project is in an early, static prototype phase.

## Installation

To install all dependencies, simply run:

```
npm install
```

### Local Development

To setup the Contentful instance, create an account, create a Content Management API (CMA) token and then add the value to your .env file:

```
CONTENTFUL_MANAGEMENT_TOKEN=...
```

If you have not already created your Space manually, it can be automatically created by supplying the name in your .env file:

```
CONTENTFUL_SPACE_NAME=...
```

If you have already created your Space, then add the ID to your .env file instead (this will be added automatically if you allow setup to create it for you):

```
REACT_APP_CONTENTFUL_SPACE_ID=...
```

Finally, you can optionally set your own Content Type name for all the posts with this .env variable (it will automatically be set to "Blog Post" if you leave this blank - it is only for readability for content administrators):

```
REACT_APP_CONTENTFUL_CONTENT_TYPE=...
```

Once all the necessary variables have been set, execute the following command to setup your Contentful instance:

```
npm run setup
```

All of these steps _must_ be completed locally, before deploying remotely.

## Running locally

To build and run the site locally, execute the following command:

```
npm run dev
```
