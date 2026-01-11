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

Once all the necessary variables have been set, execute the following command:

```
npm run setup:cms
```

### Domain Hosting

Before initialising the remote AWS environment or deploying the site, you need to add the following environment variables:

- `AWS_STACK` - The name for your CloudFormation stack
- `AWS_REGION` - The region to deploy to
- `AWS_ACCESS_KEY_ID` - The access key for an AWS user with the relevant permissions
- `AWS_SECRET_ACCESS_KEY` - The secret for the above AWS user

Manual DNS configuration with your hosting provider is unavoidable, so this pipeline is therefore intentionally split into `init` and `finalise` phases.

1. You must set the domain name in your environment variables in order for CloudFront to successfully resolve it (and to produce a valid certificate):
    - `DOMAIN` - the full domain name (e.g. example.com or blog.example.com)

    > Note: The certificate MUST be generated in us-east-1 AWS region, this is a restriction imposed by Amazon.

2. To configure Route 53 to host your site, add the following to your .env file:
    - `AWS_ENABLE_ROUTE53` - true if you want to use Route 53; false if you plan to use your own nameservers and point directly to CloudFront

    > Route 53 is optional - you can point your existing domain/subdomain directly to CloudFront if you prefer. When enabled, certificate validation and DNS records are fully automated and no manual DNS changes are required beyond updating your nameservers. However, additional monthly costs will be incurred.

3. Now execute the following to perform the initial setup of AWS resources:

    ```
    npm run setup:aws -- -phase=init
    ```

    This will then expose the values you need to insert manually with your hosting provider.

4. Login to your hosting provider's admin system.

5. Navigate to DNS Management (usually under Domain > Manage DNS > DNS Management or something similar).
    - **Route53**

        Create new NS records for the domain/subdomain (there should be a separate record for each NS server provided by Route 53, so 4 in total):
        - **Type:** NS
        - **Name:** www (if you plan on running the site under the main domain) or whatever your subdomain prefix is (i.e. for blog.example.com this will be "blog")
        - **Value:** One of the NS servers from your Route 53 output (repeat this step for all 4 servers)
        - **TTL:** Choose the shortest option (e.g. 1/2 hour or 1800 seconds)

    - **Custom hosting provider plus CloudFront**

        Create new CNAME records for the domain/subdomain, one for the CloudFront domain:
        - **Type:** CNAME
        - **Name:** www (if you plan on running the site under the main domain) or whatever your subdomain prefix is (i.e. for blog.example.com this will be "blog")
        - **Value:** The CloudFront domain (e.g. xyz123abc.cloudfront.net)
        - **TTL:** Choose the shortest option (e.g. 1/2 hour or 1800 seconds)

        And one for the ACM certificate:
        - **Type:** CNAME
        - **Name:** The CNAME record "name" returned by ACM. Some DNS providers require the full hostname (e.g. \_12345abcde.blog.example.com), while others only require the relative name (e.g. \_12345abcde.blog). Follow your provider's guidance.
        - **Value:** The CNAME record "value" returned for the ACM certificate.
        - **TTL:** Choose the shortest option (e.g. 1/2 hour or 1800 seconds)

6. Save changes.

7. Verify the changes have worked using nslookup:

    ```
    nslookup blog.example.com
    ```

    > DNS propagation can typically take 5–30 minutes, but may take longer depending on your DNS provider.

8. Once this is done, you can continue with:

    ```
    npm run setup:aws -- -phase=finalise
    ```

9. Test in your browser once you have completed the [Build and Deployment](#build-and-deployment) steps (e.g. https://blog.example.com)

All of these steps _must_ be completed locally before deploying the site.

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

To build the site and deploy it to AWS, execute the following command:

```
npm run deploy
```

The deployment script clears the bucket before upload and ensures correct MIME types.

## CI/CD

This project is setup to be automated (as far as possible) by GitHub Actions. To do so, first you must add the necessary secrets and variables to your repository via **Project Settings > Secrets and variables > Actions**:

| Secrets                     | Variables               |
| --------------------------- | ----------------------- |
| AWS_ACCESS_KEY_ID           | AWS_STACK               |
| AWS_REGION                  | CONTENTFUL_CONTENT_TYPE |
| AWS_SECRET_ACCESS_KEY       | CONTENTFUL_SPACE_NAME   |
| CONTENTFUL_DELIVERY_TOKEN   | DOMAIN                  |
| CONTENTFUL_MANAGEMENT_TOKEN |                         |
| CONTENTFUL_SPACE_ID         |                         |

As the pipeline needs to update secrets as part of the setup, you also need to create a **Personal Access Token** -

1. Go to your **GitHub profile > Developer Settings > Personal access tokens > Fine-grained tokens**
2. Click "Generate new token"
3. Name it appropriately (e.g. "Blog Pipeline Token")
4. Choose "Only select repositories" and select the repo for this project
5. Grant "Read and Write" access to secrets
6. Copy the token and add it to secrets as `PAT_TOKEN`

### Running the Workflows

The workflows must be run sequentially:

**1) Initial Contentful and AWS Setup**

- Trigger this workflow first.
- It will create the initial AWS resources and output the DNS records you need to configure with your hosting provider.
- Manual DNS configuration is required before continuing; otherwise the finalise step may timeout.
- **Important**: Remember, some DNS providers require the full hostname (e.g. \_12345abcde.blog.example.com), while others only require the relative name (e.g. \_12345abcde.blog). Follow your provider's guidance.

**2) Finalise AWS Setup**

- After configuring DNS, run this workflow to complete the AWS setup.
- This workflow also triggers the deployment workflow automatically for an initial upload of the site.

**3) Deploy React App**

- Once the first two steps have completed, this workflow can be triggered anytime to deploy changes to the front-end.

> **Important**:
>
> - The initial pipeline outputs DNS records to the logs - this will be exposed publicly in a public repository, so it is recommended you either run these workflows in a private repo, or remove that output and manually retrieve the values from the AWS console.
> - Contentful setup must be completely locally before running.
> - The finalise and deploy workflows check that the required previous steps have successfully run, and will not run otherwise.
> - DNS propagation can sometimes take longer than expected; if the site doesn’t work immediately after manual DNS changes, wait a while and retry the finalise workflow.

## Tearing Down

If you need to completely remove this deployment, follow these steps carefully:

1. **Empty the S3 bucket** – CloudFormation cannot delete a stack if the bucket contains objects.
2. **(If using Route 53) Delete any CNAME records that have been created in Route 53 Hosted Zone** - Only the default A, NS, and SOA records are automatically removed when deleting the stack.
3. **Delete the main stack** - You must delete the stack containing S3, CloudFront ( and optionally Route 53) resources first.
4. **Delete the ACM certificate stack** - Only after all the above steps have successfully completed. Certificates cannot be deleted while still associated with a CloudFront distribution. _(Remember, this stack must live in us-east-1.)_
