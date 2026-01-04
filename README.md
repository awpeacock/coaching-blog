# Coaching Blog

A very basic blog built in React (using Vite).

Content is retrieved via Contentful (headless CMS), with a locally stored JSON fallback. Hosting is performed on AWS (S3, CloudFront and optionally Route53) and configured via CloudFormation.

## Setup

To install all dependencies, simply run:

```
npm install
```

### Contentful

To setup the Contentful instance, create an account, create a Content Management API (CMA) token and then add the following values to your .env file:

- `CONTENTFUL_MANAGEMENT_TOKEN` - Your CMA token
- `CONTENTFUL_SPACE_NAME` - (Optional) If you have not already created your Space manually, it can be automatically created by supplying the name
- `VITE_CONTENTFUL_SPACE_ID` - If you have already created your Space, then add the ID (this will be added automatically if you allow setup to create it for you)
- `VITE_CONTENTFUL_CONTENT_TYPE` - (Optional) Type name for all posts (defaults to "Blog Post") - only for readability for content administrators)

### Domain Hosting

You must set the domain name in your environment variables in order for CloudFront to successfully resolve it (and to produce a valid certificate):

- `DOMAIN` - the full domain name (e.g. example.com or blog.example.com)

> Note: The certificate MUST be generated in us-east-1 AWS region, this is a restriction imposed by Amazon.

#### Route 53 (Optional)

> Route 53 is optional - you can point your existing domain/subdomain directly to CloudFront if you prefer.

1. To configure Route 53 to host your site, add the following to your .env file:
    - `AWS_ENABLE_ROUTE53` - true if you want to use Route 53; false if you plan to use your own nameservers and point directly to CloudFront

2. When you run the deployment script below, it will then output the NS records created as part of the Route 53 setup. Note these down.

3. Login to your hosting provider's admin system.

4. Navigate to DNS Management (usually under Domain > Manage DNS > DNS Management or something similar).

5. Create new NS records for the domain/subdomain (there should be a separate record for each NS server provided by Route 53, so 4 in total):
    - **Name:** www (if you plan on running the site under the main domain) or whatever your subdomain prefix is (i.e. for blog.example.com this will be "blog")
    - **Type:** NS
    - **Value:** One of the NS servers from your Route 53 output (repeat this step for all 4 servers)
    - **TTL:** Choose the shortest option (e.g. 1/2 hour or 1800 seconds)

6. Save changes.

7. Verify the changes have worked using nslookup:

    ```
    nslookup blog.example.com
    ```

    > DNS propagation can take 5–30 minutes.

8. Test in your browser once you have completed the [Build and Deployment](#build-and-deployment) steps (e.g. https://blog.example.com)

### Initialising

Once all the necessary variables have been set, execute the following command to setup your Contentful instance:

```
npm run setup
```

All of these steps _must_ be completed locally before deploying remotely.

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

## Tearing Down

If you need to completely remove this deployment, follow these steps carefully:

1. **Empty the S3 bucket** – CloudFormation cannot delete a stack if the bucket contains objects.
2. **Delete any CNAME records that have been created manually in Route 53 Hosted Zone** - Only the default A, NS, and SOA records are automatically removed when deleting the stack.
3. **Delete the main stack** - You must delete the satck containing S3, CloudFront ( and optionally Route 53) resources first.
4. **Delete the ACM certificate stack** - Only after all the above steps have successfully completed. Certificates cannot be deleted while still associated with a CloudFront distribution. _(Remember, this stack must live in us-east-1.)_
