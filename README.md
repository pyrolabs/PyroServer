Main Pyro Server

# Functionality
The server is currently capable of the following:
## Current
* Creating Firebase Instances
* Creating S3 Buckets
* Copying Seed from CDN to newly created S3 bucket
* Seed Update

## Future
* Creating Firebase Accounts
* Creating Custom Auth Objects
* Enabling Auth on new Firebase Accounts
* Push Notification
* File Upload

# Endpoints
## Current
* `/api`
    - `/generate` - Generates app
        + Paramerters: 
    - `/create`- DEPRECATED Originally used for creating firebase instances before S3 capability existed 
    - `/delete` - NOT WORKING Deletes the following:
        + Firebase Instance
        + S3 Bucket
    - `/update` - PlANNED DEPRECATION Updates version of seed that is locationed on the server. To speed up single generate endpoint files are being kept on server instead of downloaded from CDN every time.
    - `/test` - Testing endpoint that is often changing functionality

## Planned

### Soon

* `/createAccount` - Create a firebase account with information passed in request. Match Firebase Admin API.

* `/enableLogin` - Enable email/password auth. This will require an auth token as well as a call to the Firebase Admin API.

### Future

* `/push` - Generalized Push Notification. Should be able to target specific users by id (maybe multiple params later).

* `/upload` - Generalized File upload