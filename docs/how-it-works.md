# How it works
## Authorization
Every request to the anonymization service must be authorized by [bearer token in an authorization header](https://tools.ietf.org/html/rfc6750).

Bearer token is provided by [`API_TOKEN`](../README.md#configuration) enviromental variable. `API_TOKEN` variable will be replaced with OAuth 2.0 Client Credentials Grant Type flow in the [future](../README.md#future-improvements).

## Pseudonymization
Definitions:
- `PII`: Personally Identifiable Information (email address, names, etc.)
- `Requesting service`: It's the client requesting pseudonimized data from the Google Workplace, O365 etc. APIs.
- `Pseudonymization service`: Is an instance of this service from this repository

### Input data pseudonymization
The following sections represent pseudonymization of data coming IN from the requesting service to the pseudonymization service. It's perfectly possible for the requesting service to request data about a user (specific email address) without knowing the email address.

#### PII data in the incoming API requests
It's possible to encrypt any PII data, if the requesting service can't know them. In that case any PII data in the request are pseudonymized as an RSA encrypted string.

- Private key can be provided by [`RSA_PRIVATE_KEY`](../README.md#configuration) enviromental variable (or by [`RSA-PRIVATE-KEY`](../README.md#configuration) vault secret). You can use the [src/helpers/genKey.js](../src/helpers/genKey.js) utility to generate Private and Public key pair.
- In this case, all the encrypted email addresses have to be in a format starting with the `__rsa__` prefix, like this example: `__rsa__IIJRAIBADANBgkqhkiG9w0BA...` and the RSA encrypted string has to be url-encoded safe Base64 string. See the [src/anonymizer/helpers/encrypt-url-component.helper.ts](../src/anonymizer/helpers/encrypt-url-component.helper.ts) function and use this implementation on your data requesting back-end.

Output PII data is anonymized by salted `sha512` ([src/anonymizer/helpers/hash.helper.ts](../src/anonymizer/helpers/hash.helper.ts)) hashing function and the result is shortened to **first 16 characters**.
- Salt can be provided by [`ANONYMIZATION_SALT`](../README.md#configuration) enviromental variable (or by [`ANONYMIZATION-SALT`](../README.md#configuration) vault secret)

### Output data pseudonymization
The following sections represent the pseudonymization of data that are send back to the requesting service from the pseudonymization service.

#### Email pseudonymization ([src/anonymizer/transformers/email.transformer.ts](../src/anonymizer/transformers/email.transformer.ts))
- The service recognizes 2 types of domains:
  1. internal - owned or controlled by your organization
  2. external
- Internal domains can be set by providing comma separated list of values to [`INTERNAL_DOMAIN_LIST`](../README.md#configuration) enviromental variable
- Email address (username@domain.com) anonymization depends on [`INTERNAL_DOMAIN_LIST`, `ANONYMIZE_INTERNAL_EMAIL_USERNAME`, `ANONYMIZE_INTERNAL_EMAIL_DOMAIN`, `ANONYMIZE_EXTERNAL_EMAIL_USERNAME`, `ANONYMIZE_EXTERNAL_EMAIL_DOMAIN`](../README.md#configuration) enviromental variables
- Every email address part is hashed by salted `sha512` ([src/anonymizer/helpers/hash.helper.ts](../src/anonymizer/helpers/hash.helper.ts)) function and truncated to the **first 16 characters**


##### Example: Internal domain pseudonymization
| Email             | [`ANONYMIZE_INTERNAL_EMAIL_USERNAME`](../README.md#configuration) | [`ANONYMIZE_INTERNAL_EMAIL_DOMAIN`](../README.md#configuration) | Anonymized email
| ----------------- | ----------------------------------- | --------------------------------- | ------------------
| user@internal.com | false                               | false                             | user@internal.com
| user@internal.com | false                               | true                              | user@anonymized.hash
| user@internal.com | true                                | false                             | anonymized@internal.com
| user@internal.com | true                                | true                              | anonymized@anonymized.hash

##### Example: External domain pseudonymization
| Email             | [`ANONYMIZE_EXTERNAL_EMAIL_USERNAME`](../README.md#configuration) | [`ANONYMIZE_EXTERNAL_EMAIL_DOMAIN`](../README.md#configuration) | Anonymized email
| ----------------- | ----------------------------------- | --------------------------------- | ------------------
| user@external.com | false                               | false                             | user@external.com
| user@external.com | false                               | true                              | user@anonymized.hash
| user@external.com | true                                | false                             | anonymized@external.com
| user@external.com | true                                | true                              | anonymized@anonymized.hash

#### File name pseudonymization ([src/anonymizer/transformers/filename.transformer.ts](../src/anonymizer/transformers/filename.transformer.ts))
- File name is replaced by character `'x'` (repeated `n times`) - `n` is the length of file name without extension
- File extension is always preserved

##### Example: File names pseudonymization
| File name             | Anonymized file name
| --------------------- | ---------------------
| somefilename.jpg      | xxxxxxxxxxxx.jpg
| .env                  | .env
| filename              | xxxxxxxx

#### Pseudonymization of private data in object properties

Every private property value is removed from the response.

##### Example: Pseudonymized private object properties
| Field type        | Return value
| ----------------- | -----------------------------------
| username          | empty string                       
| summary           | empty string                       
| description       | empty string                       
| subject           | empty string                       
| password          | empty string                       
| pin               | empty string                       
| secret string     | empty string                       
| secret boolean    | false
| secret number     | 0
| secret array      | empty array

## How to get Google API credentials
Follow https://developers.google.com/admin-sdk/directory/v1/guides/delegation guide to perform domain-wide delegation of authority with https://www.googleapis.com/auth/gmail.readonly and/or https://www.googleapis.com/auth/calendar.readonly API scopes.

Use `client_email` and `private_key` from generated service account credentials file (`credentials.json`) as [`GSUITE_CLIENT_EMAIL`](../README.md../README.md#configuration) and [`GSUITE_PRIVATE_KEY`](../README.md../README.md#configuration) enviromental variables respectively.

Populate `GSUITE_SCOPES` enviromental variable with comma separated scopes used in the service account creation guide.

## How to get Office 365 credentials
Follow https://docs.microsoft.com/en-us/office/office-365-management-api/get-started-with-office-365-management-apis to create Office 365 tenant ID, client ID and client Secret. Populate generated values to `O365_TENANT_ID`, `O365_CLIENT_ID`, `O365_CLIENT_SECRET` enviromental variables.
