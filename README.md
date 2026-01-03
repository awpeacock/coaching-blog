# Coaching Blog

A very basic blog built in React (using Vite).

At present, content is retrieved via Contentful (headless CMS), with a locally stored JSON fallback. Longer term, it is to be hosted on AWS (S3, Route53 and CloudFront via CloudFormation).

## Status

This project is in an early prototype phase - static content is built and deployed to S3, and made publicly accessible by CloudFront.

## Setup

To install all dependencies, simply run:

```
npm install
```

### Local Development

To setup the Contentful instance, create an account, create a Content Management API (CMA) token and then add the following values to your .env file:

- `CONTENTFUL_MANAGEMENT_TOKEN` - Your CMA token
- `CONTENTFUL_SPACE_NAME` - (Optional) If you have not already created your Space manually, it can be automatically created by supplying the name
- `VITE_CONTENTFUL_SPACE_ID` - If you have already created your Space, then add the ID (this will be added automatically if you allow setup to create it for you)
- `VITE_CONTENTFUL_CONTENT_TYPE` - (Optional) Type name for all posts (defaults to "Blog Post") - only for readability for content administrators)

Once all the necessary variables have been set, execute the following command to setup your Contentful instance:

```
npm run setup
```

All of these steps _must_ be completed locally, before deploying remotely.

### Front-end Configuration

Once the Contentful CMS is setup, you will need to create a Delivery API token on the Contentful admin site and add it to your .env file (as well as the variables previously configured):

- `VITE_CONTENTFUL_DELIVERY_TOKEN` - Your Delivery token

## Content Structure

No content is hardcoded within the site - everything is supplied either by Contentful, i18n substitutions or a JSON fallback; the default being Contentful.

### i18n Translation

All labels are contained within `src/i18n/en/translation.json` (at present there is no intention to provide multiple language support; i18n is used for structured labelling and future extensibility).

- `title`: The site title both within the META tags, and the H1 on the homepage.
- `home`: The ALT text for the home button
- `error`: The default error message to show to the user should any unexpected failures occur.
- `404`: The error message to show to the user if the post cannot be found.
- `january`-`december`: The months as displayed on the publication date for each post.

### JSON Fallback

Should the site be unable to retrieve the requested content from Contentful, it will look within `src/data/pages.json` for fallback content. Add content for `home` here to provide default content should Contentful be unresponsive.

## Running locally

To build and run the site locally, execute the following command:

```
npm run dev
```

## Build and Deployment

To build the site for deployment, execute the following command:

```
npm run build
```

To build the site and deploy to AWS, first you need to add the following environment variables:

- `AWS_STACK` - The name for your CloudFormation stack
- `AWS_REGION` - The region to deploy to
- `AWS_ACCESS_KEY_ID` - The access key for an AWS user with the relevant permissions
- `AWS_SECRET_ACCESS_KEY` - The secret for the above AWS user

Then execute the following command (which will also run the build command):

```
npm run deploy
```

> The deployment script clears the bucket before upload and ensures correct MIME types.

> The deployment script will read the generated values from the CloudFront generation and output the publicly accessible domain. You can use this value to preview the site.
