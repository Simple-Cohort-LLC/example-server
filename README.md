### Example Server

A simple NodeJS server for Farcaster clients.

Uses the Neynar Nodejs SDK. View the documentation there for how the [nodejs sdk](https://github.com/neynarxyz/nodejs-sdk) works. You'll need an account with an API key.

Uses [Pinata's APIs](https://docs.pinata.cloud/api-reference/introduction). View documentation for how to get set up and get your API key.

#### Requirements

Node version 20+

#### Running the App

`npm i`

`npm start`

#### Additional Features

This server also contains a [Prisma](https://github.com/prisma) database for storing content from the [Zora](https://zora.co) network.

There is a script in [./scripts/zora.js](./scripts/zora.js) that scrapes the Zora web app and stores token information in the prisma db. This content can be used to provide some more interesting content to your Farcaster client from Zora. See the `/zora` endpoint in [./app.js](./app.js) for how you can retrieve it.

#### API Key

See the function `authenticateApiKey` in [app.js](./app.js). Your client will need to pass an API key in the headers that you whitelist in this repo.

#### Hosting

Recommend hosting this on cloud platforms once it is customized to your needs. Then you can access it in development and don't have to worry about running the server every time you work. You can also run the [Zora script](./scripts/zora.js) on a cronjob to leverage the additional content from Zora.

