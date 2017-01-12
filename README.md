# rhmap-deploy-detector

A Red Hat Mobile compatible microservice that will determine if the deployed
status of any node.js applications on a given domain have been modified.

Would be useful to attach to a Slack plugin or Push enabled mobile application.

## Prerequisites

This will work locally if you have the following installed. Other versions
probably work, but are not tested.

* MongoDB >= 2.4.6
* node.js >= 4.4.3
* npm >= 2.15

## Usage

Using the service locally is simple, just run the following commands:

_On Windows you might need to use "set" instead of export_
```bash
git clone $PATH_TO_THIS_REPO rhmap-deploy-detector

cd rhmap-deploy-detector

npm install

# e.g acmedeveloper@acme-mobile.com
export FHC_USER=$VALID_EMAIL_FOR_STUDIO

# e.g acmemobilerulez
export FHC_PASS=$PASSWORD_FOR_EMAIL_FOR_STUDIO

# e.g acme-mobile.redhatmobile.com
export FHC_DOMAIN=$YOUR_DOMAIN

npm start
```

## Endpoints

### GET /applications/deploys/status
Returns any applications that have had their deploy status modified since this
route was last called.

Sample response:
```json"
{
  "acme-dev": [
    "Deploy status for Acme Authentication Service (ab3gdh3kgth4gsam3w0g5kgb) changed to \"inprogress\" at 2017-01-12T21:04:54.292Z"
  ],
  "acme-test": [],
  "acme-pre-prod": [],
  "acme-prod": []
}"
```
