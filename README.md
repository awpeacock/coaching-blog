# Coaching Blog

A very basic blog built in React (using Vite).

At present, content is retrieved via Contentful (headless CMS), with a locally stored JSON fallback. Longer term, it is to be hosted on AWS (S3, Route53 and CloudFront via CloudFormation).

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
VITE_CONTENTFUL_SPACE_ID=...
```

Finally, you can optionally set your own Content Type name for all the posts with this .env variable (it will automatically be set to "Blog Post" if you leave this blank - it is only for readability for content administrators):

```
VITE_CONTENTFUL_CONTENT_TYPE=...
```

Once all the necessary variables have been set, execute the following command to setup your Contentful instance:

```
npm run setup
```

All of these steps _must_ be completed locally, before deploying remotely.

### Front-end Configuration

Once the Contentful CMS is setup, you will need to create a Delivery API token on the Contentful admin site and add it to your .env file (as well as the variables previously configured):

```
VITE_CONTENTFUL_DELIVERY_TOKEN=...
```

### Content

No content is hardcoded within the site - everything is supplied either by Contentful, i18n substitutions or a JSON fallback.

#### i18n Translation

All labels are contained within `src/i18n/en/translation.json` (at present there is no intention to provide multiple language support; i18n is used for structured labelling and future extensibility).

- `title`: The site title both within the META tags, and the H1 on the homepage.
- `home`: The ALT text for the home button
- `error`: The default error message to show to the user should any unexpected failures occur.
- `404`: The error message to show to the user if the post cannot be found.
- `january`-`december`: The months as displayed on the publication date for each post.

#### JSON Fallback

Should the site be unable to retrieve the requested content from Contentful, it will look within `src/data/pages.json` for fallback content. Add content for `home` here to provide default content should Contentful be unresponsive.

## Running locally

To build and run the site locally, execute the following command:

```
npm run dev
```
